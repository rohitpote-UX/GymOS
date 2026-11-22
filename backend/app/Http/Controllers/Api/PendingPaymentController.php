<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DiscountAudit;
use App\Models\Invoice;
use App\Models\Payment;
use App\Services\FinanceService;
use App\Support\CurrentBranch;
use App\Support\CurrentGym;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PendingPaymentController extends Controller
{
    public function __construct(
        protected FinanceService $financeService
    ) {}

    /**
     * Centralized Pending Payments & Udhar view with 4 top KPIs and filterable invoice records.
     */
    public function index(Request $request): JsonResponse
    {
        $gymId = CurrentGym::require();
        $branchId = $request->query('branch_id') ?: CurrentBranch::id();

        // Ensure legacy memberships have invoices synthesized
        $this->financeService->ensureInvoicesForMemberships($gymId);

        $today = now()->toDateString();

        // 1. Calculate the 4 Top KPI Stat Cards
        $baseKpiQuery = Invoice::where('gym_id', $gymId)->where('status', '!=', 'cancelled');
        if ($branchId) {
            $baseKpiQuery->where('branch_id', $branchId);
        }

        $totalOutstanding = (clone $baseKpiQuery)->sum('balance_due');

        $overdueAmount = (clone $baseKpiQuery)
            ->where('balance_due', '>', 0)
            ->whereDate('due_date', '<', $today)
            ->sum('balance_due');

        $partialInvoicesCount = (clone $baseKpiQuery)
            ->where('status', 'partially_paid')
            ->count();

        $payQuery = Payment::where('gym_id', $gymId)
            ->whereDate('payment_date', $today)
            ->where('status', 'completed')
            ->where('type', 'payment');
        if ($branchId) {
            $payQuery->where('branch_id', $branchId);
        }
        $collectedToday = $payQuery->sum('amount');

        // 2. Query Invoices List
        $query = Invoice::with([
            'member:id,first_name,last_name,phone,member_code',
            'branch:id,name,code',
            'membership.plan:id,name,price',
            'allocations.payment:id,receipt_number,amount,payment_method,payment_date',
        ])
            ->where('gym_id', $gymId)
            ->where('status', '!=', 'cancelled');

        if ($branchId) {
            $query->where('branch_id', $branchId);
        }

        // Filter by Status Tab
        $status = $request->query('status', 'pending');
        if ($status === 'overdue') {
            $query->where('balance_due', '>', 0)->whereDate('due_date', '<', $today);
        } elseif ($status === 'unpaid') {
            $query->where('balance_due', '>', 0)->where('paid_amount', '<=', 0);
        } elseif ($status === 'partially_paid') {
            $query->where('status', 'partially_paid');
        } elseif ($status === 'paid') {
            $query->where('balance_due', '<=', 0);
        } elseif ($status === 'pending') {
            $query->where('balance_due', '>', 0);
        } // 'all' includes paid too

        // Date Range Filters
        if ($request->filled('from_due')) {
            $query->whereDate('due_date', '>=', $request->query('from_due'));
        }
        if ($request->filled('to_due')) {
            $query->whereDate('due_date', '<=', $request->query('to_due'));
        }

        // Search Filter
        if ($request->filled('search')) {
            $search = '%' . trim($request->query('search')) . '%';
            $query->where(function ($q) use ($search) {
                $q->where('invoice_number', 'like', $search)
                    ->orWhereHas('member', function ($mq) use ($search) {
                        $mq->where('first_name', 'like', $search)
                            ->orWhere('last_name', 'like', $search)
                            ->orWhere('phone', 'like', $search)
                            ->orWhere('member_code', 'like', $search);
                    });
            });
        }

        // Sorting: Overdue first, then due today, then upcoming, then latest
        $invoices = $query->orderByRaw("
            CASE 
                WHEN balance_due > 0 AND due_date < '{$today}' THEN 1
                WHEN balance_due > 0 AND due_date = '{$today}' THEN 2
                WHEN balance_due > 0 THEN 3
                ELSE 4
            END ASC
        ")
            ->orderBy('due_date', 'asc')
            ->orderBy('id', 'desc')
            ->paginate($request->query('per_page', 20));

        // Format and append dynamic statuses
        $invoices->getCollection()->transform(function (Invoice $inv) {
            $inv->effective_status = $inv->calculateDynamicStatus();
            $inv->days_overdue = ($inv->due_date && $inv->due_date->isPast() && $inv->balance_due > 0)
                ? (int) now()->startOfDay()->diffInDays($inv->due_date->startOfDay())
                : 0;
            return $inv;
        });

        return response()->json([
            'kpis' => [
                'total_outstanding' => (float) $totalOutstanding,
                'overdue_amount' => (float) $overdueAmount,
                'partial_invoices_count' => $partialInvoicesCount,
                'collected_today' => (float) $collectedToday,
            ],
            'invoices' => $invoices,
        ]);
    }

    /**
     * Collect payment installment for pending invoice.
     */
    public function collect(Request $request, int $invoiceId): JsonResponse
    {
        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'min:1'],
            'payment_method' => ['required', 'in:cash,upi,card,online,bank_transfer,cheque'],
            'payment_date' => ['nullable', 'date'],
            'reference_id' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:500'],
            'client_uuid' => ['nullable', 'uuid'],
        ]);

        $result = $this->financeService->collectInstallment(
            invoiceId: $invoiceId,
            amount: (float) $validated['amount'],
            paymentMethod: $validated['payment_method'],
            paymentDate: $validated['payment_date'] ?? null,
            referenceId: $validated['reference_id'] ?? null,
            notes: $validated['notes'] ?? null,
            user: $request->user(),
            clientUuid: $validated['client_uuid'] ?? null
        );

        return response()->json([
            'message' => 'Payment installment collected successfully.',
            'payment' => $result['payment'],
            'invoice' => $result['invoice'],
        ], 201);
    }

    /**
     * Send trilingual payment reminder via WhatsApp.
     */
    public function reminder(Request $request, int $invoiceId): JsonResponse
    {
        $validated = $request->validate([
            'language' => ['nullable', 'in:en,mr,hi'],
        ]);

        $result = $this->financeService->sendPaymentReminder(
            invoiceId: $invoiceId,
            sender: $request->user(),
            language: $validated['language'] ?? null
        );

        return response()->json($result);
    }

    /**
     * Get debt aging breakdown.
     */
    public function aging(Request $request): JsonResponse
    {
        $gymId = CurrentGym::require();
        $branchId = $request->query('branch_id') ?: CurrentBranch::id();

        $report = $this->financeService->getAgingReport($gymId, $branchId);

        return response()->json($report);
    }

    /**
     * Get discount audit logs and summary.
     */
    public function discounts(Request $request): JsonResponse
    {
        $gymId = CurrentGym::require();
        $query = DiscountAudit::with(['user:id,name,role', 'approver:id,name', 'invoice:id,invoice_number,member_id', 'invoice.member:id,first_name,last_name'])
            ->where('gym_id', $gymId)
            ->latest('created_at');

        $audits = $query->paginate(25);
        $totalDiscountAmount = DiscountAudit::where('gym_id', $gymId)->sum('discount_amount');

        return response()->json([
            'total_discount_granted' => (float) $totalDiscountAmount,
            'audits' => $audits,
        ]);
    }
}
