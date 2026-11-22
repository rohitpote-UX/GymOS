<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\DiscountAudit;
use App\Models\Invoice;
use App\Models\Member;
use App\Models\MemberLedger;
use App\Models\MemberMembership;
use App\Models\MembershipPlan;
use App\Models\Payment;
use App\Models\PaymentAllocation;
use App\Models\PaymentReminder;
use App\Models\User;
use App\Support\CurrentGym;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class FinanceService
{
    /**
     * Validate discount permissions by role.
     */
    public function validateDiscount(User $user, float $subtotal, string $discountType, float $discountValue, ?string $reason = null): array
    {
        $discountAmount = 0.0;
        if ($discountType === 'percentage') {
            $pct = min(100.0, max(0.0, $discountValue));
            $discountAmount = round($subtotal * ($pct / 100.0), 2);
        } elseif ($discountType === 'fixed') {
            $discountAmount = min($subtotal, max(0.0, $discountValue));
        }

        if ($discountAmount <= 0) {
            return [
                'discount_amount' => 0.0,
                'discount_value' => 0.0,
                'discount_type' => 'none',
                'status' => 'auto_approved',
            ];
        }

        $role = $user->role;

        // Gym Owner & Super Admin have full discounting authority
        if (in_array($role, ['gym_owner', 'super_admin'])) {
            return [
                'discount_amount' => $discountAmount,
                'discount_value' => $discountValue,
                'discount_type' => $discountType,
                'status' => 'approved',
                'approved_by_user_id' => $user->id,
            ];
        }

        // Branch Manager: max 25% or ₹1,500
        if ($role === 'branch_manager') {
            $maxPct = 25.0;
            $maxFixed = 1500.0;
            $pctEquivalent = ($subtotal > 0) ? (($discountAmount / $subtotal) * 100.0) : 0;
            if ($discountAmount > $maxFixed || $pctEquivalent > $maxPct) {
                throw ValidationException::withMessages([
                    'discount_amount' => ['Discount exceeds Branch Manager threshold (Max ₹1,500 or 25%). Gym Owner authorization required.'],
                ]);
            }
            return [
                'discount_amount' => $discountAmount,
                'discount_value' => $discountValue,
                'discount_type' => $discountType,
                'status' => 'approved',
                'approved_by_user_id' => $user->id,
            ];
        }

        // Receptionist / Front Desk: max 10% or ₹500
        if (in_array($role, ['receptionist', 'front_desk'])) {
            $maxPct = 10.0;
            $maxFixed = 500.0;
            $pctEquivalent = ($subtotal > 0) ? (($discountAmount / $subtotal) * 100.0) : 0;
            if ($discountAmount > $maxFixed || $pctEquivalent > $maxPct) {
                throw ValidationException::withMessages([
                    'discount_amount' => ['Discount exceeds Staff threshold (Max ₹500 or 10%). Gym Owner authorization required.'],
                ]);
            }
            return [
                'discount_amount' => $discountAmount,
                'discount_value' => $discountValue,
                'discount_type' => $discountType,
                'status' => 'approved',
                'approved_by_user_id' => $user->id,
            ];
        }

        // Trainer or others have no discounting permission
        throw ValidationException::withMessages([
            'discount_amount' => ['Your role is not authorized to grant membership discounts.'],
        ]);
    }

    /**
     * Create an official Invoice for a membership purchase or renewal.
     */
    public function createMembershipInvoice(
        Member $member,
        MembershipPlan $plan,
        MemberMembership $membership,
        User $user,
        float $paidAmount,
        string $paymentMethod = 'cash',
        string $discountType = 'none',
        float $discountValue = 0.0,
        ?string $discountReason = null,
        ?string $dueDate = null,
        ?string $referenceId = null,
        ?string $notes = null,
        ?string $clientUuid = null
    ): Invoice {
        return DB::transaction(function () use (
            $member,
            $plan,
            $membership,
            $user,
            $paidAmount,
            $paymentMethod,
            $discountType,
            $discountValue,
            $discountReason,
            $dueDate,
            $referenceId,
            $notes,
            $clientUuid
        ) {
            $subtotal = (float) $plan->price;
            $discountData = $this->validateDiscount($user, $subtotal, $discountType, $discountValue, $discountReason);
            $discountAmount = $discountData['discount_amount'];

            $taxRate = 0.0;
            $taxAmount = 0.0;
            $totalAmount = max(0.0, $subtotal - $discountAmount + $taxAmount);

            $paid = min($totalAmount, max(0.0, $paidAmount));
            $balanceDue = max(0.0, $totalAmount - $paid);

            $resolvedDueDate = $dueDate ? Carbon::parse($dueDate)->toDateString() : now()->addDays(7)->toDateString();

            // Next sequential invoice number for this gym
            $lastInvoice = Invoice::withoutGlobalScopes()->where('gym_id', $member->gym_id)->latest('id')->first();
            $nextSeq = $lastInvoice ? ($lastInvoice->id + 1) : 1;
            $invoiceNumber = 'INV-' . date('Y') . '-' . str_pad((string) $nextSeq, 5, '0', STR_PAD_LEFT);

            // Compute status
            $status = 'unpaid';
            if ($balanceDue <= 0.001) {
                $status = 'paid';
            } elseif ($paid > 0) {
                $status = 'partially_paid';
            }

            if ($balanceDue > 0 && Carbon::parse($resolvedDueDate)->isPast() && !Carbon::parse($resolvedDueDate)->isToday()) {
                $status = 'overdue';
            }

            $invoice = Invoice::create([
                'gym_id' => $member->gym_id,
                'branch_id' => $membership->branch_id,
                'member_id' => $member->id,
                'member_membership_id' => $membership->id,
                'invoice_number' => $invoiceNumber,
                'invoice_date' => now()->toDateString(),
                'due_date' => $resolvedDueDate,
                'subtotal' => $subtotal,
                'discount_type' => $discountData['discount_type'],
                'discount_value' => $discountData['discount_value'],
                'discount_amount' => $discountAmount,
                'discount_reason' => $discountReason,
                'discount_approved_by_user_id' => $discountData['approved_by_user_id'] ?? null,
                'tax_rate' => $taxRate,
                'tax_amount' => $taxAmount,
                'total_amount' => $totalAmount,
                'paid_amount' => $paid,
                'balance_due' => $balanceDue,
                'status' => $status,
                'notes' => $notes,
                'created_by_user_id' => $user->id,
            ]);

            // Record discount audit if applicable
            if ($discountAmount > 0) {
                DiscountAudit::create([
                    'gym_id' => $member->gym_id,
                    'user_id' => $user->id,
                    'invoice_id' => $invoice->id,
                    'discount_type' => $discountData['discount_type'],
                    'discount_value' => $discountData['discount_value'],
                    'discount_amount' => $discountAmount,
                    'reason' => $discountReason,
                    'approved_by_user_id' => $discountData['approved_by_user_id'] ?? null,
                    'status' => $discountData['status'],
                ]);
            }

            // If initial payment was made
            if ($paid > 0) {
                $lastPayment = Payment::withoutGlobalScopes()->where('gym_id', $member->gym_id)->latest('id')->first();
                $nextPaySeq = $lastPayment ? ($lastPayment->id + 1) : 1;
                $receiptNumber = 'REC-' . date('Y') . '-' . str_pad((string) $nextPaySeq, 5, '0', STR_PAD_LEFT);

                $payment = Payment::create([
                    'gym_id' => $member->gym_id,
                    'branch_id' => $membership->branch_id,
                    'member_id' => $member->id,
                    'member_membership_id' => $membership->id,
                    'invoice_id' => $invoice->id,
                    'receipt_number' => $receiptNumber,
                    'type' => 'payment',
                    'client_uuid' => $clientUuid,
                    'amount' => $paid,
                    'discount_amount' => $discountAmount,
                    'balance_after_payment' => $balanceDue,
                    'payment_method' => $paymentMethod,
                    'payment_date' => now()->toDateString(),
                    'reference_id' => $referenceId,
                    'status' => 'completed',
                    'notes' => $notes,
                    'collected_by_user_id' => $user->id,
                ]);

                // Record allocation
                PaymentAllocation::create([
                    'gym_id' => $member->gym_id,
                    'payment_id' => $payment->id,
                    'invoice_id' => $invoice->id,
                    'amount' => $paid,
                    'allocated_at' => now(),
                    'allocated_by_user_id' => $user->id,
                ]);
            }

            // Sync membership amounts
            $membership->update([
                'total_price' => $subtotal,
                'discount_amount' => $discountAmount,
                'final_price' => $totalAmount,
                'price_paid' => $paid,
                'balance_due' => $balanceDue,
            ]);

            $member->recalculateBalances();

            return $invoice;
        });
    }

    /**
     * Collect payment installment against an invoice.
     * Uses row-level locking for concurrency protection.
     */
    public function collectInstallment(
        int $invoiceId,
        float $amount,
        string $paymentMethod,
        ?string $paymentDate = null,
        ?string $referenceId = null,
        ?string $notes = null,
        ?User $user = null,
        ?string $clientUuid = null
    ): array {
        // Idempotency check with client_uuid
        if ($clientUuid) {
            $existing = Payment::where('client_uuid', $clientUuid)->first();
            if ($existing) {
                return [
                    'payment' => $existing->load(['member', 'branch', 'invoice']),
                    'invoice' => $existing->invoice,
                    'idempotent' => true,
                ];
            }
        }

        return DB::transaction(function () use (
            $invoiceId,
            $amount,
            $paymentMethod,
            $paymentDate,
            $referenceId,
            $notes,
            $user,
            $clientUuid
        ) {
            /** @var Invoice $invoice */
            $invoice = Invoice::where('id', $invoiceId)->lockForUpdate()->firstOrFail();

            if ($invoice->status === 'cancelled') {
                throw ValidationException::withMessages([
                    'amount' => ['Cannot collect payment against a cancelled invoice.'],
                ]);
            }

            if ($amount <= 0) {
                throw ValidationException::withMessages([
                    'amount' => ['Payment amount must be greater than zero.'],
                ]);
            }

            $currentBalance = (float) $invoice->balance_due;
            if ($amount > $currentBalance) {
                throw ValidationException::withMessages([
                    'amount' => ["Payment amount (₹{$amount}) cannot exceed current outstanding balance (₹{$currentBalance})."],
                ]);
            }

            $member = $invoice->member()->lockForUpdate()->first();
            $branchId = $invoice->branch_id;

            // Sequential receipt number
            $lastPayment = Payment::withoutGlobalScopes()->where('gym_id', $invoice->gym_id)->latest('id')->first();
            $nextSeq = $lastPayment ? ($lastPayment->id + 1) : 1;
            $receiptNumber = 'REC-' . date('Y') . '-' . str_pad((string) $nextSeq, 5, '0', STR_PAD_LEFT);

            $payDate = $paymentDate ? Carbon::parse($paymentDate)->toDateString() : now()->toDateString();

            // 1. Create Payment
            $payment = Payment::create([
                'gym_id' => $invoice->gym_id,
                'branch_id' => $branchId,
                'member_id' => $invoice->member_id,
                'member_membership_id' => $invoice->member_membership_id,
                'invoice_id' => $invoice->id,
                'receipt_number' => $receiptNumber,
                'type' => 'payment',
                'client_uuid' => $clientUuid,
                'amount' => $amount,
                'discount_amount' => 0,
                'balance_after_payment' => max(0, $currentBalance - $amount),
                'payment_method' => $paymentMethod,
                'payment_date' => $payDate,
                'reference_id' => $referenceId,
                'status' => 'completed',
                'notes' => $notes,
                'collected_by_user_id' => $user?->id,
            ]);

            // 2. Create Payment Allocation
            PaymentAllocation::create([
                'gym_id' => $invoice->gym_id,
                'payment_id' => $payment->id,
                'invoice_id' => $invoice->id,
                'amount' => $amount,
                'allocated_at' => now(),
                'allocated_by_user_id' => $user?->id,
            ]);

            // 3. Update Invoice
            $newPaid = (float) $invoice->paid_amount + $amount;
            $newBalance = max(0.0, (float) $invoice->total_amount - $newPaid);
            $invoice->paid_amount = $newPaid;
            $invoice->balance_due = $newBalance;
            $invoice->status = $invoice->calculateDynamicStatus();
            $invoice->save();

            // 4. Update linked Membership if present
            if ($invoice->member_membership_id) {
                $membership = MemberMembership::where('id', $invoice->member_membership_id)->lockForUpdate()->first();
                if ($membership) {
                    $membership->price_paid = (float) $membership->price_paid + $amount;
                    $membership->balance_due = max(0.0, (float) $membership->balance_due - $amount);
                    $membership->save();
                }
            }

            // 5. Member Financial Ledger Entry (Credit)
            MemberLedger::create([
                'gym_id' => $invoice->gym_id,
                'branch_id' => $branchId,
                'member_id' => $invoice->member_id,
                'type' => 'payment',
                'reference_type' => 'payment',
                'reference_id' => $payment->id,
                'description' => "Installment #{$receiptNumber} for Invoice #{$invoice->invoice_number} via " . strtoupper($paymentMethod),
                'debit' => 0,
                'credit' => $amount,
                'running_balance' => max(0, ($member?->outstanding_balance ?? 0) - $amount),
                'transaction_date' => $payDate,
                'created_by_user_id' => $user?->id,
            ]);

            // 6. Authoritative member balance recalculation
            $member?->recalculateBalances();

            AuditLog::record('payment.collected', [
                'payment_id' => $payment->id,
                'invoice_id' => $invoice->id,
                'amount' => $amount,
                'receipt' => $receiptNumber,
                'member_id' => $invoice->member_id,
            ], $branchId);

            return [
                'payment' => $payment->load(['member', 'branch', 'invoice']),
                'invoice' => $invoice->fresh(['member', 'allocations.payment']),
            ];
        });
    }

    /**
     * Generate Aging Report.
     */
    public function getAgingReport(int $gymId, ?int $branchId = null): array
    {
        $today = now()->startOfDay();

        $query = Invoice::where('gym_id', $gymId)
            ->where('status', '!=', 'cancelled')
            ->where('balance_due', '>', 0);

        if ($branchId) {
            $query->where('branch_id', $branchId);
        }

        $invoices = $query->with('member:id,first_name,last_name,phone,member_code', 'branch:id,name')->get();

        $buckets = [
            'not_due' => ['label' => 'Current / Not Due', 'count' => 0, 'amount' => 0.0, 'invoices' => []],
            '1_to_7' => ['label' => '1 - 7 Days Overdue', 'count' => 0, 'amount' => 0.0, 'invoices' => []],
            '8_to_30' => ['label' => '8 - 30 Days Overdue', 'count' => 0, 'amount' => 0.0, 'invoices' => []],
            '31_to_60' => ['label' => '31 - 60 Days Overdue', 'count' => 0, 'amount' => 0.0, 'invoices' => []],
            'over_60' => ['label' => '60+ Days Overdue', 'count' => 0, 'amount' => 0.0, 'invoices' => []],
        ];

        $totalOutstanding = 0.0;
        $totalOverdue = 0.0;

        foreach ($invoices as $inv) {
            $due = Carbon::parse($inv->due_date)->startOfDay();
            $balance = (float) $inv->balance_due;
            $totalOutstanding += $balance;

            $item = [
                'id' => $inv->id,
                'invoice_number' => $inv->invoice_number,
                'member_name' => $inv->member ? "{$inv->member->first_name} {$inv->member->last_name}" : 'Member',
                'phone' => $inv->member?->phone,
                'member_code' => $inv->member?->member_code,
                'branch_name' => $inv->branch?->name,
                'due_date' => $inv->due_date->format('Y-m-d'),
                'total_amount' => (float) $inv->total_amount,
                'paid_amount' => (float) $inv->paid_amount,
                'balance_due' => $balance,
            ];

            if ($due->gte($today)) {
                $buckets['not_due']['count']++;
                $buckets['not_due']['amount'] += $balance;
                $item['days_overdue'] = 0;
                $buckets['not_due']['invoices'][] = $item;
            } else {
                $days = (int) abs($today->diffInDays($due));
                $item['days_overdue'] = $days;
                $totalOverdue += $balance;

                if ($days <= 7) {
                    $buckets['1_to_7']['count']++;
                    $buckets['1_to_7']['amount'] += $balance;
                    $buckets['1_to_7']['invoices'][] = $item;
                } elseif ($days <= 30) {
                    $buckets['8_to_30']['count']++;
                    $buckets['8_to_30']['amount'] += $balance;
                    $buckets['8_to_30']['invoices'][] = $item;
                } elseif ($days <= 60) {
                    $buckets['31_to_60']['count']++;
                    $buckets['31_to_60']['amount'] += $balance;
                    $buckets['31_to_60']['invoices'][] = $item;
                } else {
                    $buckets['over_60']['count']++;
                    $buckets['over_60']['amount'] += $balance;
                    $buckets['over_60']['invoices'][] = $item;
                }
            }
        }

        return [
            'total_outstanding' => round($totalOutstanding, 2),
            'total_overdue' => round($totalOverdue, 2),
            'total_invoices_count' => $invoices->count(),
            'buckets' => $buckets,
        ];
    }

    /**
     * Dispatch WhatsApp reminder for pending invoice.
     */
    public function sendPaymentReminder(int $invoiceId, ?User $sender = null, ?string $language = null): array
    {
        $invoice = Invoice::with(['member', 'branch'])->findOrFail($invoiceId);

        if ($invoice->balance_due <= 0 || $invoice->status === 'cancelled') {
            throw ValidationException::withMessages([
                'invoice' => ['Invoice has no pending dues or is cancelled.'],
            ]);
        }

        $member = $invoice->member;
        if (!$member || empty($member->phone)) {
            throw ValidationException::withMessages([
                'phone' => ['Member has no registered phone number.'],
            ]);
        }

        $lang = $language ?: $member->language_preference ?: 'en';
        $gymName = $invoice->gym?->name ?? 'Gym Business';
        $memberName = $member->first_name;
        $balanceDue = number_format((float) $invoice->balance_due, 2);
        $dueDate = $invoice->due_date ? $invoice->due_date->format('d M Y') : 'N/A';

        // Trilingual reminder text
        if ($lang === 'mr') {
            $msg = "नमस्कार {$memberName}, {$gymName} कडून नम्र आठवण. आपल्या जिम मेंबरशिपचे ₹{$balanceDue} पेमेंट बाकी आहे (शेवटची तारीख: {$dueDate}). कृपया आपल्या सोयीनुसार पेमेंट पूर्ण करावे. धन्यवाद!";
        } elseif ($lang === 'hi') {
            $msg = "नमस्ते {$memberName}, {$gymName} की ओर से अनुस्मारक। आपकी जिम सदस्यता का ₹{$balanceDue} बकाया है (अंतिम तिथि: {$dueDate})। कृपया अपनी सुविधानुसार भुगतान पूरा करें। धन्यवाद!";
        } else {
            $msg = "Hello {$memberName}, this is a gentle reminder from {$gymName}. Your gym membership has an outstanding balance of ₹{$balanceDue} (Due Date: {$dueDate}). Please complete your payment at your earliest convenience. Thank you!";
        }

        // Record reminder
        $reminder = PaymentReminder::create([
            'gym_id' => $invoice->gym_id,
            'branch_id' => $invoice->branch_id,
            'member_id' => $member->id,
            'invoice_id' => $invoice->id,
            'phone' => $member->phone,
            'channel' => 'whatsapp',
            'language' => $lang,
            'amount_due' => $invoice->balance_due,
            'message' => $msg,
            'status' => 'sent',
            'sent_by_user_id' => $sender?->id,
        ]);

        return [
            'success' => true,
            'reminder' => $reminder,
            'message' => $msg,
            'phone' => $member->phone,
        ];
    }

    /**
     * Backward-compatibility bridge: Automatically synthesize Invoices for legacy member_memberships
     * that do not have an Invoice yet, ensuring no pending balances are lost.
     */
    public function ensureInvoicesForMemberships(int $gymId): int
    {
        $membershipsWithoutInvoice = MemberMembership::where('gym_id', $gymId)
            ->whereDoesntHave('invoices')
            ->get();

        $count = 0;
        foreach ($membershipsWithoutInvoice as $m) {
            $subtotal = (float) $m->total_price;
            $discount = (float) $m->discount_amount;
            $total = (float) $m->final_price;
            $paid = (float) $m->price_paid;
            $balance = (float) $m->balance_due;

            $status = 'unpaid';
            if ($balance <= 0.001) {
                $status = 'paid';
            } elseif ($paid > 0) {
                $status = 'partially_paid';
            }

            $dueDate = $m->start_date ? Carbon::parse($m->start_date)->addDays(14)->toDateString() : now()->toDateString();
            if ($balance > 0 && Carbon::parse($dueDate)->isPast()) {
                $status = 'overdue';
            }

            $lastInvoice = Invoice::withoutGlobalScopes()->where('gym_id', $gymId)->latest('id')->first();
            $nextSeq = $lastInvoice ? ($lastInvoice->id + 1) : 1;
            $invoiceNumber = 'INV-' . date('Y') . '-' . str_pad((string) $nextSeq, 5, '0', STR_PAD_LEFT);

            $invoice = Invoice::create([
                'gym_id' => $gymId,
                'branch_id' => $m->branch_id,
                'member_id' => $m->member_id,
                'member_membership_id' => $m->id,
                'invoice_number' => $invoiceNumber,
                'invoice_date' => $m->start_date ? $m->start_date->toDateString() : now()->toDateString(),
                'due_date' => $dueDate,
                'subtotal' => $subtotal,
                'discount_type' => $discount > 0 ? 'fixed' : 'none',
                'discount_value' => $discount,
                'discount_amount' => $discount,
                'total_amount' => $total,
                'paid_amount' => $paid,
                'balance_due' => $balance,
                'status' => $status,
                'notes' => 'Synthesized from historical membership',
            ]);

            // Link existing payments if present
            $payments = Payment::where('member_membership_id', $m->id)->get();
            foreach ($payments as $p) {
                $p->update(['invoice_id' => $invoice->id]);
                PaymentAllocation::create([
                    'gym_id' => $gymId,
                    'payment_id' => $p->id,
                    'invoice_id' => $invoice->id,
                    'amount' => $p->amount,
                    'allocated_at' => $p->payment_date ? Carbon::parse($p->payment_date) : now(),
                ]);
            }

            $count++;
        }

        return $count;
    }
}
