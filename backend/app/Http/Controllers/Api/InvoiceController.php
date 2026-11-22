<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Invoice;
use App\Support\CurrentBranch;
use App\Support\CurrentGym;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InvoiceController extends Controller
{
    /**
     * List all invoices for the current gym.
     */
    public function index(Request $request): JsonResponse
    {
        $gymId = CurrentGym::require();
        $branchId = $request->query('branch_id') ?: CurrentBranch::id();

        $query = Invoice::with([
            'member:id,first_name,last_name,phone,member_code',
            'branch:id,name,code',
            'membership.plan:id,name',
            'allocations.payment',
        ])
            ->where('gym_id', $gymId);

        if ($branchId) {
            $query->where('branch_id', $branchId);
        }

        if ($request->filled('member_id')) {
            $query->where('member_id', $request->query('member_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        if ($request->filled('from')) {
            $query->whereDate('invoice_date', '>=', $request->query('from'));
        }

        if ($request->filled('to')) {
            $query->whereDate('invoice_date', '<=', $request->query('to'));
        }

        $invoices = $query->latest('id')->paginate($request->query('per_page', 20));

        return response()->json($invoices);
    }

    /**
     * Show detailed invoice view with payment history and receipts.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $gymId = CurrentGym::require();
        $invoice = Invoice::with([
            'member',
            'branch',
            'membership.plan',
            'creator:id,name',
            'discountApprover:id,name',
            'allocations.payment.collector:id,name',
            'reminders',
        ])
            ->where('gym_id', $gymId)
            ->findOrFail($id);

        $invoice->effective_status = $invoice->calculateDynamicStatus();

        return response()->json($invoice);
    }

    /**
     * Cancel an invoice (gym owner or branch manager only).
     */
    public function cancel(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!in_array($user->role, ['gym_owner', 'super_admin', 'branch_manager'])) {
            return response()->json(['message' => 'Unauthorized to cancel invoices.'], 403);
        }

        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:255'],
        ]);

        $gymId = CurrentGym::require();
        $invoice = Invoice::where('gym_id', $gymId)->findOrFail($id);

        if ($invoice->status === 'cancelled') {
            return response()->json(['message' => 'Invoice is already cancelled.'], 422);
        }

        $invoice->status = 'cancelled';
        $invoice->notes = ($invoice->notes ? $invoice->notes . ' | ' : '') . "Cancelled by {$user->name}: {$validated['reason']}";
        $invoice->save();

        if ($invoice->member_membership_id) {
            $membership = $invoice->membership;
            if ($membership) {
                $membership->status = 'cancelled';
                $membership->cancelled_at = now();
                $membership->cancellation_reason = $validated['reason'];
                $membership->save();
            }
        }

        $invoice->member?->recalculateBalances();

        AuditLog::record('invoice.cancelled', [
            'invoice_id' => $invoice->id,
            'reason' => $validated['reason'],
        ], $invoice->branch_id);

        return response()->json([
            'message' => 'Invoice cancelled successfully.',
            'invoice' => $invoice,
        ]);
    }
}
