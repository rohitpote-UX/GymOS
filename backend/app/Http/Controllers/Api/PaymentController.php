<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\DiscountAudit;
use App\Models\Invoice;
use App\Models\Member;
use App\Models\MemberLedger;
use App\Models\MemberMembership;
use App\Models\MembershipPlan;
use App\Models\Payment;
use App\Models\PaymentAllocation;
use App\Services\FinanceService;
use App\Support\CurrentBranch;
use App\Support\CurrentGym;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PaymentController extends Controller
{
    public function index(Request $request)
    {
        $query = Payment::with([
            'member:id,first_name,last_name,member_code,phone',
            'branch:id,name,code',
            'collector:id,name',
            'membership.plan:id,name',
        ]);

        $branchId = $request->query('branch_id') ?: CurrentBranch::id();
        if ($branchId) {
            $query->where('branch_id', $branchId);
        }

        if ($request->filled('from')) {
            $query->whereDate('payment_date', '>=', $request->input('from'));
        }

        if ($request->filled('to')) {
            $query->whereDate('payment_date', '<=', $request->input('to'));
        }

        if ($request->filled('payment_method')) {
            $query->where('payment_method', $request->input('payment_method'));
        }

        if ($request->filled('type')) {
            $query->where('type', $request->input('type'));
        }

        if ($request->filled('member_id')) {
            $query->where('member_id', $request->input('member_id'));
        }

        $payments = $query->latest('payment_date')->latest('id')->paginate($request->input('per_page', 20));

        $totalCollected = (clone $query)->where('status', 'completed')->where('type', 'payment')->sum('amount');
        $totalRefunded = (clone $query)->where('status', 'completed')->where('type', 'refund')->sum('amount');

        return response()->json([
            'payments' => $payments,
            'summary' => [
                'total_amount' => (float) $totalCollected,
                'total_refunded' => (float) $totalRefunded,
                'net_amount' => (float) ($totalCollected - $totalRefunded),
            ],
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'member_id' => ['required', 'exists:members,id'],
            'amount' => ['required', 'numeric', 'min:1'],
            'payment_method' => ['required', 'in:cash,upi,card,bank_transfer,cheque'],
            'payment_date' => ['nullable', 'date'],
            'reference_id' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string'],
            'branch_id' => ['nullable', 'exists:branches,id'],
            'client_uuid' => ['nullable', 'uuid'],
            // Optional membership renewal/assignment
            'membership_plan_id' => ['nullable', 'exists:membership_plans,id'],
            'member_membership_id' => ['nullable', 'exists:member_memberships,id'],
            'invoice_id' => ['nullable', 'exists:invoices,id'],
            'discount_amount' => ['nullable', 'numeric', 'min:0'],
            'due_date' => ['nullable', 'date'],
        ]);

        // Idempotency: If client_uuid was already processed, return existing payment
        if (!empty($validated['client_uuid'])) {
            $existing = Payment::where('client_uuid', $validated['client_uuid'])->first();
            if ($existing) {
                return response()->json($existing->load(['member', 'branch', 'membership.plan']), 200);
            }
        }

        return DB::transaction(function () use ($validated, $request) {
            $member = Member::findOrFail($validated['member_id']);
            $branchId = $validated['branch_id'] ?? CurrentBranch::id() ?? $member->primary_branch_id;

            $membershipId = $validated['member_membership_id'] ?? null;
            $invoiceId = $validated['invoice_id'] ?? null;
            $discount = (float) ($validated['discount_amount'] ?? 0);

            // If paying towards an existing invoice directly
            if ($invoiceId) {
                $financeResult = app(FinanceService::class)->collectInstallment(
                    invoiceId: (int) $invoiceId,
                    amount: (float) $validated['amount'],
                    paymentMethod: $validated['payment_method'],
                    paymentDate: $validated['payment_date'] ?? null,
                    referenceId: $validated['reference_id'] ?? null,
                    notes: $validated['notes'] ?? null,
                    user: $request->user(),
                    clientUuid: $validated['client_uuid'] ?? null
                );
                return response()->json($financeResult['payment'], 201);
            }

            // If renewing/purchasing a membership plan
            if (!empty($validated['membership_plan_id'])) {
                $plan = MembershipPlan::findOrFail($validated['membership_plan_id']);

                // Calculate renewal dates (extend from active end date if future, else from today)
                $activeMembership = $member->activeMembership;
                $startDate = ($activeMembership && $activeMembership->end_date->isFuture())
                    ? $activeMembership->end_date->copy()->addDay()
                    : now();

                $endDate = $startDate->copy()->addDays($plan->duration_days);
                $finalPrice = max(0, (float) $plan->price - $discount);
                $balanceDue = max(0, $finalPrice - (float) $validated['amount']);

                $membership = MemberMembership::create([
                    'gym_id' => CurrentGym::require(),
                    'branch_id' => $branchId,
                    'member_id' => $member->id,
                    'membership_plan_id' => $plan->id,
                    'assigned_trainer_id' => $member->assigned_trainer_id,
                    'start_date' => $startDate->toDateString(),
                    'end_date' => $endDate->toDateString(),
                    'status' => 'active',
                    'category' => $plan->category ?? 'monthly',
                    'total_price' => $plan->price,
                    'discount_amount' => $discount,
                    'final_price' => $finalPrice,
                    'price_paid' => $validated['amount'],
                    'balance_due' => $balanceDue,
                    'total_pt_sessions' => $plan->pt_sessions_count ?? 0,
                    'completed_pt_sessions' => 0,
                ]);

                // Create Invoice
                $resolvedDueDate = !empty($validated['due_date'])
                    ? Carbon::parse($validated['due_date'])->toDateString()
                    : now()->addDays(7)->toDateString();

                $lastInvoice = Invoice::withoutGlobalScopes()->where('gym_id', $member->gym_id)->latest('id')->first();
                $nextInvSeq = $lastInvoice ? ($lastInvoice->id + 1) : 1;
                $invoiceNumber = 'INV-' . date('Y') . '-' . str_pad((string) $nextInvSeq, 5, '0', STR_PAD_LEFT);

                $invStatus = 'unpaid';
                if ($balanceDue <= 0.001) {
                    $invStatus = 'paid';
                } elseif ((float) $validated['amount'] > 0) {
                    $invStatus = 'partially_paid';
                }
                if ($balanceDue > 0 && Carbon::parse($resolvedDueDate)->isPast() && !Carbon::parse($resolvedDueDate)->isToday()) {
                    $invStatus = 'overdue';
                }

                $invoice = Invoice::create([
                    'gym_id' => CurrentGym::require(),
                    'branch_id' => $branchId,
                    'member_id' => $member->id,
                    'member_membership_id' => $membership->id,
                    'invoice_number' => $invoiceNumber,
                    'invoice_date' => now()->toDateString(),
                    'due_date' => $resolvedDueDate,
                    'subtotal' => $plan->price,
                    'discount_type' => $discount > 0 ? 'fixed' : 'none',
                    'discount_value' => $discount,
                    'discount_amount' => $discount,
                    'tax_rate' => 0,
                    'tax_amount' => 0,
                    'total_amount' => $finalPrice,
                    'paid_amount' => $validated['amount'],
                    'balance_due' => $balanceDue,
                    'status' => $invStatus,
                    'notes' => $validated['notes'] ?? null,
                    'created_by_user_id' => $request->user()->id,
                ]);
                $invoiceId = $invoice->id;

                MemberLedger::create([
                    'gym_id' => CurrentGym::require(),
                    'branch_id' => $branchId,
                    'member_id' => $member->id,
                    'type' => 'charge',
                    'reference_type' => 'membership',
                    'reference_id' => $membership->id,
                    'description' => "Enrolment: {$plan->name} [Inv #{$invoiceNumber}]",
                    'debit' => $finalPrice,
                    'credit' => 0,
                    'running_balance' => $member->outstanding_balance + $finalPrice,
                    'transaction_date' => now()->toDateString(),
                    'created_by_user_id' => $request->user()->id,
                ]);

                $member->update(['status' => 'active']);
                $membershipId = $membership->id;
            } elseif ($membershipId) {
                // If paying towards an existing membership
                $membership = MemberMembership::findOrFail($membershipId);
                $membership->price_paid += (float) $validated['amount'];
                $membership->balance_due = max(0, (float) $membership->balance_due - (float) $validated['amount']);
                $membership->save();

                // If membership has an invoice, update it too
                $invoice = Invoice::where('member_membership_id', $membershipId)->first();
                if ($invoice) {
                    $invoiceId = $invoice->id;
                }
            }

            // Generate sequential receipt number
            $lastPayment = Payment::latest('id')->first();
            $nextSeq = $lastPayment ? ($lastPayment->id + 1) : 1;
            $receiptNumber = 'REC-' . date('Y') . '-' . str_pad((string) $nextSeq, 5, '0', STR_PAD_LEFT);

            $payment = Payment::create([
                'gym_id' => CurrentGym::require(),
                'branch_id' => $branchId,
                'member_id' => $member->id,
                'member_membership_id' => $membershipId,
                'invoice_id' => $invoiceId,
                'receipt_number' => $receiptNumber,
                'type' => 'payment',
                'client_uuid' => $validated['client_uuid'] ?? null,
                'amount' => $validated['amount'],
                'discount_amount' => $discount,
                'balance_after_payment' => max(0, $member->outstanding_balance - (float) $validated['amount']),
                'payment_method' => $validated['payment_method'],
                'payment_date' => $validated['payment_date'] ?? now()->toDateString(),
                'reference_id' => $validated['reference_id'] ?? null,
                'status' => 'completed',
                'notes' => $validated['notes'] ?? null,
                'collected_by_user_id' => $request->user()->id,
            ]);

            if ($invoiceId) {
                PaymentAllocation::create([
                    'gym_id' => CurrentGym::require(),
                    'payment_id' => $payment->id,
                    'invoice_id' => $invoiceId,
                    'amount' => $validated['amount'],
                    'allocated_at' => now(),
                    'allocated_by_user_id' => $request->user()->id,
                ]);
                $inv = Invoice::find($invoiceId);
                if ($inv) {
                    $inv->syncFromAllocations();
                }
            }

            // Record Credit in Member Financial Ledger
            MemberLedger::create([
                'gym_id' => CurrentGym::require(),
                'branch_id' => $branchId,
                'member_id' => $member->id,
                'type' => 'payment',
                'reference_type' => 'payment',
                'reference_id' => $payment->id,
                'description' => "Payment #{$receiptNumber} via " . strtoupper($validated['payment_method']),
                'debit' => 0,
                'credit' => $validated['amount'],
                'running_balance' => max(0, $member->outstanding_balance - (float) $validated['amount']),
                'transaction_date' => now()->toDateString(),
                'created_by_user_id' => $request->user()->id,
            ]);

            // Server-side balance recalculation
            $member->recalculateBalances();

            AuditLog::record('payment.collected', [
                'payment_id' => $payment->id,
                'amount' => $payment->amount,
                'receipt' => $receiptNumber,
                'member_id' => $member->id,
            ], $branchId);

            return response()->json($payment->load(['member', 'branch', 'membership.plan']), 201);
        });
    }

    public function refund(Request $request, int $id)
    {
        $originalPayment = Payment::with('member')->findOrFail($id);

        if ($originalPayment->type === 'refund') {
            return response()->json(['message' => 'Cannot refund a refund record.'], 422);
        }

        $validated = $request->validate([
            'refund_amount' => ['required', 'numeric', 'min:1', "max:{$originalPayment->amount}"],
            'payment_method' => ['nullable', 'in:cash,upi,card,bank_transfer,cheque'],
            'notes' => ['required', 'string', 'max:255'],
        ]);

        return DB::transaction(function () use ($originalPayment, $validated, $request) {
            $lastPayment = Payment::latest('id')->first();
            $receiptNumber = 'REF-' . date('Y') . '-' . str_pad((string) (($lastPayment?->id ?? 0) + 1), 5, '0', STR_PAD_LEFT);

            $refundPayment = Payment::create([
                'gym_id' => CurrentGym::require(),
                'branch_id' => $originalPayment->branch_id,
                'member_id' => $originalPayment->member_id,
                'member_membership_id' => $originalPayment->member_membership_id,
                'refund_payment_id' => $originalPayment->id,
                'receipt_number' => $receiptNumber,
                'type' => 'refund',
                'amount' => $validated['refund_amount'],
                'payment_method' => $validated['payment_method'] ?? $originalPayment->payment_method,
                'payment_date' => now()->toDateString(),
                'status' => 'completed',
                'notes' => "Refund against receipt #{$originalPayment->receipt_number}: {$validated['notes']}",
                'collected_by_user_id' => $request->user()->id,
            ]);

            MemberLedger::create([
                'gym_id' => CurrentGym::require(),
                'branch_id' => $originalPayment->branch_id,
                'member_id' => $originalPayment->member_id,
                'type' => 'refund',
                'reference_type' => 'payment',
                'reference_id' => $refundPayment->id,
                'description' => "Refund #{$receiptNumber} against #{$originalPayment->receipt_number}",
                'debit' => $validated['refund_amount'],
                'credit' => 0,
                'running_balance' => $originalPayment->member->outstanding_balance + $validated['refund_amount'],
                'transaction_date' => now()->toDateString(),
                'created_by_user_id' => $request->user()->id,
            ]);

            $originalPayment->member->recalculateBalances();

            AuditLog::record('payment.refunded', [
                'original_payment_id' => $originalPayment->id,
                'refund_payment_id' => $refundPayment->id,
                'amount' => $validated['refund_amount'],
                'receipt' => $receiptNumber,
            ], $originalPayment->branch_id);

            return response()->json([
                'message' => 'Refund processed successfully.',
                'refund' => $refundPayment->load('member'),
            ], 201);
        });
    }

    public function show(int $id)
    {
        $payment = Payment::with([
            'member:id,first_name,last_name,member_code,phone,email,address',
            'branch',
            'collector:id,name',
            'membership.plan',
            'refunds',
        ])->findOrFail($id);

        return response()->json($payment);
    }
}
