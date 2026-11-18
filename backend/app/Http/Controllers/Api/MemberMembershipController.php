<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Member;
use App\Models\MemberLedger;
use App\Models\MemberMembership;
use App\Models\MemberMembershipFreeze;
use App\Models\MembershipPlan;
use App\Models\Payment;
use App\Support\CurrentBranch;
use App\Support\CurrentGym;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MemberMembershipController extends Controller
{
    /**
     * Renew or purchase a new membership for a member.
     */
    public function renew(Request $request)
    {
        $validated = $request->validate([
            'member_id' => ['required', 'exists:members,id'],
            'membership_plan_id' => ['required', 'exists:membership_plans,id'],
            'paid_amount' => ['required', 'numeric', 'min:0'],
            'discount_amount' => ['nullable', 'numeric', 'min:0'],
            'payment_method' => ['required', 'in:cash,upi,card,bank_transfer,cheque'],
            'reference_id' => ['nullable', 'string', 'max:100'],
            'start_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
            'client_uuid' => ['nullable', 'uuid'],
        ]);

        return DB::transaction(function () use ($validated, $request) {
            $member = Member::findOrFail($validated['member_id']);
            $plan = MembershipPlan::findOrFail($validated['membership_plan_id']);
            $branchId = $member->primary_branch_id ?: CurrentBranch::id();

            // Calculate start and end date: extend from current active end date if future, else from today/custom
            $activeMembership = $member->activeMembership;
            $startDate = !empty($validated['start_date'])
                ? Carbon::parse($validated['start_date'])
                : (($activeMembership && $activeMembership->end_date->isFuture())
                    ? $activeMembership->end_date->copy()->addDay()
                    : now());

            $endDate = $startDate->copy()->addDays($plan->duration_days);

            $totalPrice = (float) $plan->price;
            $discount = (float) ($validated['discount_amount'] ?? 0);
            $finalPrice = max(0, $totalPrice - $discount);
            $paidAmount = (float) $validated['paid_amount'];
            $balanceDue = max(0, $finalPrice - $paidAmount);

            // Prevent duplicate active membership of the identical plan on exact same dates
            $duplicate = MemberMembership::where('member_id', $member->id)
                ->where('membership_plan_id', $plan->id)
                ->where('start_date', $startDate->toDateString())
                ->where('status', 'active')
                ->first();

            if ($duplicate) {
                return response()->json(['message' => 'An active membership for this plan on this date already exists.'], 422);
            }

            $membership = MemberMembership::create([
                'gym_id' => CurrentGym::require(),
                'branch_id' => $branchId,
                'member_id' => $member->id,
                'membership_plan_id' => $plan->id,
                'assigned_trainer_id' => $member->assigned_trainer_id,
                'start_date' => $startDate->toDateString(),
                'end_date' => $endDate->toDateString(),
                'status' => 'active',
                'category' => $plan->category,
                'total_price' => $totalPrice,
                'discount_amount' => $discount,
                'final_price' => $finalPrice,
                'price_paid' => $paidAmount,
                'balance_due' => $balanceDue,
                'total_pt_sessions' => $plan->pt_sessions_count,
                'completed_pt_sessions' => 0,
                'notes' => $validated['notes'] ?? null,
            ]);

            // Record Debit in Member Financial Ledger for the plan fee
            MemberLedger::create([
                'gym_id' => CurrentGym::require(),
                'branch_id' => $branchId,
                'member_id' => $member->id,
                'type' => 'charge',
                'reference_type' => 'membership',
                'reference_id' => $membership->id,
                'description' => "Enrolment: {$plan->name} ({$plan->duration_days} Days)",
                'debit' => $finalPrice,
                'credit' => 0,
                'running_balance' => $member->outstanding_balance + $finalPrice,
                'transaction_date' => now()->toDateString(),
                'created_by_user_id' => $request->user()->id,
            ]);

            // Record payment if paidAmount > 0
            if ($paidAmount > 0) {
                $lastPayment = Payment::latest('id')->first();
                $receiptNumber = 'REC-' . date('Y') . '-' . str_pad((string) (($lastPayment?->id ?? 0) + 1), 5, '0', STR_PAD_LEFT);

                $payment = Payment::create([
                    'gym_id' => CurrentGym::require(),
                    'branch_id' => $branchId,
                    'member_id' => $member->id,
                    'member_membership_id' => $membership->id,
                    'receipt_number' => $receiptNumber,
                    'type' => 'payment',
                    'client_uuid' => $validated['client_uuid'] ?? null,
                    'amount' => $paidAmount,
                    'discount_amount' => $discount,
                    'balance_after_payment' => $balanceDue,
                    'payment_method' => $validated['payment_method'],
                    'payment_date' => now()->toDateString(),
                    'reference_id' => $validated['reference_id'] ?? null,
                    'status' => 'completed',
                    'collected_by_user_id' => $request->user()->id,
                ]);

                // Record Credit in Member Financial Ledger
                MemberLedger::create([
                    'gym_id' => CurrentGym::require(),
                    'branch_id' => $branchId,
                    'member_id' => $member->id,
                    'type' => 'payment',
                    'reference_type' => 'payment',
                    'reference_id' => $payment->id,
                    'description' => "Payment: Receipt #{$receiptNumber} via " . strtoupper($validated['payment_method']),
                    'debit' => 0,
                    'credit' => $paidAmount,
                    'running_balance' => max(0, ($member->outstanding_balance + $finalPrice) - $paidAmount),
                    'transaction_date' => now()->toDateString(),
                    'created_by_user_id' => $request->user()->id,
                ]);
            }

            // Recalculate member totals
            $member->update(['status' => 'active']);
            $member->recalculateBalances();

            AuditLog::record('membership.renewed', [
                'member_id' => $member->id,
                'membership_id' => $membership->id,
                'plan_name' => $plan->name,
                'end_date' => $endDate->toDateString(),
            ], $branchId);

            return response()->json([
                'message' => "Membership for {$member->full_name} activated successfully until {$endDate->toDateString()}.",
                'membership' => $membership->load(['plan', 'trainer']),
                'member' => $member->fresh(['activeMembership.plan']),
            ], 201);
        });
    }

    /**
     * Freeze an active membership.
     */
    public function freeze(Request $request, int $id)
    {
        $membership = MemberMembership::with('plan')->findOrFail($id);

        if ($membership->status !== 'active') {
            return response()->json(['message' => 'Only active memberships can be frozen.'], 422);
        }

        $validated = $request->validate([
            'freeze_days' => ['required', 'integer', 'min:1', 'max:180'],
            'reason' => ['required', 'string', 'max:255'],
        ]);

        $maxAllowed = $membership->plan->max_freeze_days ?: 60;
        if (($membership->freeze_days_used + $validated['freeze_days']) > $maxAllowed) {
            return response()->json([
                'message' => "This plan permits a maximum of {$maxAllowed} freeze days. ({$membership->freeze_days_used} days already used).",
            ], 422);
        }

        return DB::transaction(function () use ($membership, $validated, $request) {
            $membership->update([
                'status' => 'frozen',
                'freeze_start_date' => now()->toDateString(),
                'freeze_reason' => $validated['reason'],
            ]);

            MemberMembershipFreeze::create([
                'gym_id' => CurrentGym::require(),
                'member_membership_id' => $membership->id,
                'freeze_date' => now()->toDateString(),
                'days' => $validated['freeze_days'],
                'reason' => $validated['reason'],
                'processed_by_user_id' => $request->user()->id,
            ]);

            AuditLog::record('membership.frozen', [
                'membership_id' => $membership->id,
                'days' => $validated['freeze_days'],
                'reason' => $validated['reason'],
            ], $membership->branch_id);

            return response()->json([
                'message' => "Membership frozen successfully.",
                'membership' => $membership->fresh(['plan', 'freezes']),
            ]);
        });
    }

    /**
     * Unfreeze membership and push expiry date forward by frozen duration.
     */
    public function unfreeze(Request $request, int $id)
    {
        $membership = MemberMembership::findOrFail($id);

        if ($membership->status !== 'frozen') {
            return response()->json(['message' => 'Membership is not currently frozen.'], 422);
        }

        return DB::transaction(function () use ($membership, $request) {
            $freezeStart = Carbon::parse($membership->freeze_start_date ?: now());
            $frozenDays = max(1, $freezeStart->diffInDays(now()));

            // Push end date forward by frozen days
            $newEndDate = $membership->end_date->copy()->addDays($frozenDays);

            $membership->update([
                'status' => 'active',
                'end_date' => $newEndDate->toDateString(),
                'freeze_end_date' => now()->toDateString(),
                'freeze_days_used' => $membership->freeze_days_used + $frozenDays,
            ]);

            // Update freeze audit record
            $lastFreeze = MemberMembershipFreeze::where('member_membership_id', $membership->id)
                ->whereNull('unfreeze_date')
                ->latest('id')
                ->first();

            if ($lastFreeze) {
                $lastFreeze->update([
                    'unfreeze_date' => now()->toDateString(),
                    'days' => $frozenDays,
                ]);
            }

            AuditLog::record('membership.unfrozen', [
                'membership_id' => $membership->id,
                'frozen_days_added' => $frozenDays,
                'new_end_date' => $newEndDate->toDateString(),
            ], $membership->branch_id);

            return response()->json([
                'message' => "Membership unfreezed. Expiry date extended by {$frozenDays} days to {$newEndDate->toDateString()}.",
                'membership' => $membership->fresh(['plan', 'freezes']),
            ]);
        });
    }

    /**
     * Manually extend membership days with audit reason.
     */
    public function extend(Request $request, int $id)
    {
        $membership = MemberMembership::findOrFail($id);

        $validated = $request->validate([
            'days' => ['required', 'integer', 'min:1', 'max:365'],
            'reason' => ['required', 'string', 'max:255'],
        ]);

        $newEndDate = $membership->end_date->copy()->addDays($validated['days']);

        $membership->update([
            'end_date' => $newEndDate->toDateString(),
            'extended_days' => $membership->extended_days + $validated['days'],
            'extension_reason' => $validated['reason'],
        ]);

        AuditLog::record('membership.extended', [
            'membership_id' => $membership->id,
            'days' => $validated['days'],
            'reason' => $validated['reason'],
            'new_end_date' => $newEndDate->toDateString(),
        ], $membership->branch_id);

        return response()->json([
            'message' => "Membership extended by {$validated['days']} days until {$newEndDate->toDateString()}.",
            'membership' => $membership->fresh('plan'),
        ]);
    }

    /**
     * Cancel membership with optional refund payment.
     */
    public function cancel(Request $request, int $id)
    {
        $membership = MemberMembership::with('member')->findOrFail($id);

        if ($membership->status === 'cancelled') {
            return response()->json(['message' => 'Membership is already cancelled.'], 422);
        }

        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:255'],
            'refund_amount' => ['nullable', 'numeric', 'min:0'],
            'refund_payment_method' => ['nullable', 'in:cash,upi,bank_transfer,card,cheque'],
        ]);

        return DB::transaction(function () use ($membership, $validated, $request) {
            $refundAmount = (float) ($validated['refund_amount'] ?? 0);

            $membership->update([
                'status' => 'cancelled',
                'cancelled_at' => now(),
                'cancellation_reason' => $validated['reason'],
                'refund_amount' => $refundAmount,
            ]);

            // If a refund is given, record refund payment & member ledger credit
            if ($refundAmount > 0) {
                $lastPayment = Payment::latest('id')->first();
                $receiptNumber = 'REF-' . date('Y') . '-' . str_pad((string) (($lastPayment?->id ?? 0) + 1), 5, '0', STR_PAD_LEFT);

                $payment = Payment::create([
                    'gym_id' => CurrentGym::require(),
                    'branch_id' => $membership->branch_id,
                    'member_id' => $membership->member_id,
                    'member_membership_id' => $membership->id,
                    'receipt_number' => $receiptNumber,
                    'type' => 'refund',
                    'amount' => $refundAmount,
                    'payment_method' => $validated['refund_payment_method'] ?? 'cash',
                    'payment_date' => now()->toDateString(),
                    'status' => 'completed',
                    'notes' => "Refund for cancellation: {$validated['reason']}",
                    'collected_by_user_id' => $request->user()->id,
                ]);

                MemberLedger::create([
                    'gym_id' => CurrentGym::require(),
                    'branch_id' => $membership->branch_id,
                    'member_id' => $membership->member_id,
                    'type' => 'refund',
                    'reference_type' => 'payment',
                    'reference_id' => $payment->id,
                    'description' => "Refund #{$receiptNumber}: {$validated['reason']}",
                    'debit' => 0,
                    'credit' => $refundAmount,
                    'running_balance' => max(0, $membership->member->outstanding_balance - $refundAmount),
                    'transaction_date' => now()->toDateString(),
                    'created_by_user_id' => $request->user()->id,
                ]);
            }

            $membership->member->recalculateBalances();

            AuditLog::record('membership.cancelled', [
                'membership_id' => $membership->id,
                'refund_amount' => $refundAmount,
                'reason' => $validated['reason'],
            ], $membership->branch_id);

            return response()->json([
                'message' => 'Membership cancelled successfully.',
                'membership' => $membership->fresh('plan'),
                'member' => $membership->member->fresh(),
            ]);
        });
    }
}
