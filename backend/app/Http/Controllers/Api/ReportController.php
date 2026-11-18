<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AttendanceLog;
use App\Models\Branch;
use App\Models\DailyCashClosing;
use App\Models\Expense;
use App\Models\Lead;
use App\Models\Member;
use App\Models\MemberMembership;
use App\Models\Payment;
use App\Models\User;
use App\Support\CurrentBranch;
use App\Support\CurrentGym;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    /**
     * Daily business summary report
     */
    public function daily(Request $request)
    {
        $date = $request->input('date', now()->toDateString());
        $branchId = $request->query('branch_id') ?: CurrentBranch::id();

        // Payments
        $paymentQuery = Payment::whereDate('payment_date', $date)->where('status', 'completed');
        if ($branchId) {
            $paymentQuery->where('branch_id', $branchId);
        }

        $collections = (clone $paymentQuery)->where('type', 'payment')->sum('amount');
        $refunds = (clone $paymentQuery)->where('type', 'refund')->sum('amount');
        $netCollections = $collections - $refunds;

        $byMethod = (clone $paymentQuery)->where('type', 'payment')
            ->selectRaw('payment_method, SUM(amount) as total')
            ->groupBy('payment_method')
            ->pluck('total', 'payment_method');

        // New members
        $memberQuery = Member::whereDate('joined_date', $date);
        if ($branchId) {
            $memberQuery->where('primary_branch_id', $branchId);
        }
        $newMembers = $memberQuery->count();

        // New leads
        $leadQuery = Lead::whereDate('created_at', $date);
        if ($branchId) {
            $leadQuery->where('branch_id', $branchId);
        }
        $newLeads = $leadQuery->count();

        // Attendance
        $attQuery = AttendanceLog::whereDate('check_in_at', $date);
        if ($branchId) {
            $attQuery->where('branch_id', $branchId);
        }
        $totalCheckIns = $attQuery->count();

        // Expenses
        $expenseQuery = Expense::whereDate('expense_date', $date);
        if ($branchId) {
            $expenseQuery->where('branch_id', $branchId);
        }
        $totalExpenses = $expenseQuery->sum('amount');

        // Cash closing status
        $closingQuery = DailyCashClosing::whereDate('closing_date', $date);
        if ($branchId) {
            $closingQuery->where('branch_id', $branchId);
        }
        $cashClosing = $closingQuery->first();

        return response()->json([
            'date' => $date,
            'collections' => (float) $collections,
            'refunds' => (float) $refunds,
            'net_collections' => (float) $netCollections,
            'collections_by_method' => $byMethod,
            'expenses' => (float) $totalExpenses,
            'net_cash_flow' => (float) ($netCollections - $totalExpenses),
            'new_members' => $newMembers,
            'new_leads' => $newLeads,
            'total_check_ins' => $totalCheckIns,
            'cash_register' => [
                'is_closed' => (bool) $cashClosing,
                'closing_details' => $cashClosing,
            ],
        ]);
    }

    /**
     * Monthly overview & 30-day timeline
     */
    public function monthly(Request $request)
    {
        $year = (int) $request->input('year', now()->year);
        $month = (int) $request->input('month', now()->month);
        $branchId = $request->query('branch_id') ?: CurrentBranch::id();

        $startOfMonth = Carbon::createFromDate($year, $month, 1)->startOfMonth();
        $endOfMonth = $startOfMonth->copy()->endOfMonth();

        // Payments in month
        $paymentQuery = Payment::whereBetween('payment_date', [$startOfMonth->toDateString(), $endOfMonth->toDateString()])
            ->where('status', 'completed');
        if ($branchId) {
            $paymentQuery->where('branch_id', $branchId);
        }

        $collections = (clone $paymentQuery)->where('type', 'payment')->sum('amount');
        $refunds = (clone $paymentQuery)->where('type', 'refund')->sum('amount');
        $netCollections = $collections - $refunds;

        // Expenses in month
        $expenseQuery = Expense::whereBetween('expense_date', [$startOfMonth->toDateString(), $endOfMonth->toDateString()]);
        if ($branchId) {
            $expenseQuery->where('branch_id', $branchId);
        }
        $totalExpenses = $expenseQuery->sum('amount');

        // New members in month
        $memberQuery = Member::whereBetween('joined_date', [$startOfMonth->toDateString(), $endOfMonth->toDateString()]);
        if ($branchId) {
            $memberQuery->where('primary_branch_id', $branchId);
        }
        $newMembers = $memberQuery->count();

        // Daily trend array
        $dailyTrend = [];
        $current = $startOfMonth->copy();
        $today = now();

        while ($current->lte($endOfMonth) && $current->lte($today)) {
            $dateStr = $current->toDateString();
            $dayPayment = (clone $paymentQuery)->whereDate('payment_date', $dateStr)->where('type', 'payment')->sum('amount');
            $dayExpense = (clone $expenseQuery)->whereDate('expense_date', $dateStr)->sum('amount');
            
            $dayAtt = AttendanceLog::whereDate('check_in_at', $dateStr);
            if ($branchId) $dayAtt->where('branch_id', $branchId);

            $dailyTrend[] = [
                'date' => $dateStr,
                'day' => $current->format('d M'),
                'collections' => (float) $dayPayment,
                'expenses' => (float) $dayExpense,
                'check_ins' => $dayAtt->count(),
            ];

            $current->addDay();
        }

        return response()->json([
            'year' => $year,
            'month' => $month,
            'total_collections' => (float) $collections,
            'total_refunds' => (float) $refunds,
            'net_collections' => (float) $netCollections,
            'total_expenses' => (float) $totalExpenses,
            'net_operating_profit' => (float) ($netCollections - $totalExpenses),
            'new_members_count' => $newMembers,
            'daily_trend' => $dailyTrend,
        ]);
    }

    /**
     * Membership analytics & expiry forecast
     */
    public function memberships(Request $request)
    {
        $branchId = $request->query('branch_id') ?: CurrentBranch::id();

        $query = MemberMembership::query();
        if ($branchId) {
            $query->where('branch_id', $branchId);
        }

        $activeCount = (clone $query)->where('status', 'active')
            ->where('end_date', '>=', now()->toDateString())
            ->count();

        $frozenCount = (clone $query)->where('status', 'frozen')->count();

        $expiredCount = (clone $query)->where('status', 'active')
            ->where('end_date', '<', now()->toDateString())
            ->count();

        // Expiring in 7 days
        $expiring7Query = MemberMembership::with(['member:id,first_name,last_name,phone,member_code', 'plan:id,name'])
            ->where('status', 'active')
            ->whereBetween('end_date', [now()->toDateString(), now()->addDays(7)->toDateString()]);
        if ($branchId) $expiring7Query->where('branch_id', $branchId);
        $expiring7 = $expiring7Query->orderBy('end_date')->get();

        // Expiring in 15 days count
        $expiring15Count = MemberMembership::where('status', 'active')
            ->whereBetween('end_date', [now()->toDateString(), now()->addDays(15)->toDateString()]);
        if ($branchId) $expiring15Count->where('branch_id', $branchId);
        $expiring15 = $expiring15Count->count();

        // Expiring in 30 days count
        $expiring30Count = MemberMembership::where('status', 'active')
            ->whereBetween('end_date', [now()->toDateString(), now()->addDays(30)->toDateString()]);
        if ($branchId) $expiring30Count->where('branch_id', $branchId);
        $expiring30 = $expiring30Count->count();

        // Category breakdown
        $categoryBreakdown = (clone $query)->where('status', 'active')
            ->selectRaw('category, COUNT(*) as count')
            ->groupBy('category')
            ->pluck('count', 'category');

        return response()->json([
            'total_active' => $activeCount,
            'total_frozen' => $frozenCount,
            'total_expired' => $expiredCount,
            'expiring_7_days_count' => $expiring7->count(),
            'expiring_15_days_count' => $expiring15,
            'expiring_30_days_count' => $expiring30,
            'expiring_7_days_list' => $expiring7,
            'category_breakdown' => $categoryBreakdown,
        ]);
    }

    /**
     * Attendance analytics & peak hours
     */
    public function attendance(Request $request)
    {
        $branchId = $request->query('branch_id') ?: CurrentBranch::id();

        // Last 14 days attendance trend
        $trend = [];
        for ($i = 13; $i >= 0; $i--) {
            $d = now()->subDays($i)->toDateString();
            $q = AttendanceLog::whereDate('check_in_at', $d);
            if ($branchId) $q->where('branch_id', $branchId);
            $trend[] = [
                'date' => $d,
                'count' => $q->count(),
            ];
        }

        // Peak hours distribution (grouped by 2-hour blocks: 6-8, 8-10, 10-12, 12-14, 14-16, 16-18, 18-20, 20-22)
        $hourly = [
            '06:00 - 08:00' => 0,
            '08:00 - 10:00' => 0,
            '10:00 - 12:00' => 0,
            '12:00 - 14:00' => 0,
            '14:00 - 16:00' => 0,
            '16:00 - 18:00' => 0,
            '18:00 - 20:00' => 0,
            '20:00 - 22:00' => 0,
        ];

        $recentLogs = AttendanceLog::where('check_in_at', '>=', now()->subDays(30))->get();
        foreach ($recentLogs as $log) {
            $h = (int) $log->check_in_at->format('G');
            if ($h >= 6 && $h < 8) $hourly['06:00 - 08:00']++;
            elseif ($h >= 8 && $h < 10) $hourly['08:00 - 10:00']++;
            elseif ($h >= 10 && $h < 12) $hourly['10:00 - 12:00']++;
            elseif ($h >= 12 && $h < 14) $hourly['12:00 - 14:00']++;
            elseif ($h >= 14 && $h < 16) $hourly['14:00 - 16:00']++;
            elseif ($h >= 16 && $h < 18) $hourly['16:00 - 18:00']++;
            elseif ($h >= 18 && $h < 20) $hourly['18:00 - 20:00']++;
            elseif ($h >= 20 && $h < 22) $hourly['20:00 - 22:00']++;
        }

        // Inactive members (has active membership, but no check-in in last 14 days)
        $activeMembers = Member::where('status', 'active')
            ->whereHas('activeMembership')
            ->whereDoesntHave('attendance', function ($q) {
                $q->where('check_in_at', '>=', now()->subDays(14));
            })
            ->with(['activeMembership.plan', 'primaryBranch:id,name'])
            ->take(20)
            ->get();

        return response()->json([
            'daily_trend' => $trend,
            'peak_hours' => $hourly,
            'inactive_members_count' => $activeMembers->count(),
            'inactive_members_sample' => $activeMembers,
        ]);
    }

    /**
     * Outstanding dues report
     */
    public function dues(Request $request)
    {
        $branchId = $request->query('branch_id') ?: CurrentBranch::id();

        $query = Member::with(['primaryBranch:id,name', 'activeMembership.plan'])
            ->where('outstanding_balance', '>', 0);

        if ($branchId) {
            $query->where('primary_branch_id', $branchId);
        }

        $totalDues = (float) (clone $query)->sum('outstanding_balance');
        $membersWithDues = $query->orderByDesc('outstanding_balance')->paginate($request->input('per_page', 25));

        return response()->json([
            'total_dues_amount' => $totalDues,
            'members' => $membersWithDues,
        ]);
    }

    /**
     * Expense breakdown report
     */
    public function expenses(Request $request)
    {
        $from = $request->input('from', now()->startOfMonth()->toDateString());
        $to = $request->input('to', now()->toDateString());
        $branchId = $request->query('branch_id') ?: CurrentBranch::id();

        $query = Expense::whereBetween('expense_date', [$from, $to]);
        if ($branchId) {
            $query->where('branch_id', $branchId);
        }

        $total = (float) (clone $query)->sum('amount');

        $byCategory = (clone $query)
            ->selectRaw('category, SUM(amount) as total')
            ->groupBy('category')
            ->pluck('total', 'category');

        $byPaymentMethod = (clone $query)
            ->selectRaw('payment_mode, SUM(amount) as total')
            ->groupBy('payment_mode')
            ->pluck('total', 'payment_mode');

        $topExpenses = (clone $query)->with('recorder:id,name')->orderByDesc('amount')->take(10)->get();

        return response()->json([
            'from' => $from,
            'to' => $to,
            'total_amount' => $total,
            'by_category' => $byCategory,
            'by_payment_method' => $byPaymentMethod,
            'top_expenses' => $topExpenses,
        ]);
    }

    /**
     * Multi-branch revenue comparison matrix
     */
    public function branchRevenue(Request $request)
    {
        $branches = Branch::all();
        $from = $request->input('from', now()->startOfMonth()->toDateString());
        $to = $request->input('to', now()->toDateString());

        $matrix = [];
        $totals = [
            'active_members' => 0,
            'collections' => 0,
            'expenses' => 0,
            'net_profit' => 0,
        ];

        foreach ($branches as $branch) {
            $activeMembers = Member::where('primary_branch_id', $branch->id)->where('status', 'active')->count();

            $collections = (float) Payment::where('branch_id', $branch->id)
                ->whereBetween('payment_date', [$from, $to])
                ->where('status', 'completed')
                ->where('type', 'payment')
                ->sum('amount');

            $refunds = (float) Payment::where('branch_id', $branch->id)
                ->whereBetween('payment_date', [$from, $to])
                ->where('status', 'completed')
                ->where('type', 'refund')
                ->sum('amount');

            $netCollections = $collections - $refunds;

            $expenses = (float) Expense::where('branch_id', $branch->id)
                ->whereBetween('expense_date', [$from, $to])
                ->sum('amount');

            $netProfit = $netCollections - $expenses;

            $totals['active_members'] += $activeMembers;
            $totals['collections'] += $netCollections;
            $totals['expenses'] += $expenses;
            $totals['net_profit'] += $netProfit;

            $matrix[] = [
                'branch_id' => $branch->id,
                'name' => $branch->name,
                'code' => $branch->code,
                'city' => $branch->city,
                'active_members' => $activeMembers,
                'collections' => $netCollections,
                'expenses' => $expenses,
                'net_profit' => $netProfit,
            ];
        }

        return response()->json([
            'from' => $from,
            'to' => $to,
            'matrix' => $matrix,
            'totals' => $totals,
        ]);
    }

    /**
     * Stream CSV export for Excel & Sheets
     */
    public function exportCsv(Request $request, string $type)
    {
        $fileName = "gym_{$type}_" . date('Y-m-d_His') . ".csv";

        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$fileName}\"",
            'Pragma' => 'no-cache',
            'Cache-Control' => 'must-revalidate, post-check=0, pre-check=0',
            'Expires' => '0',
        ];

        return new StreamedResponse(function () use ($type) {
            $handle = fopen('php://output', 'w');

            // Add UTF-8 BOM so Excel opens it with proper encoding
            fputs($handle, "\xEF\xBB\xBF");

            if ($type === 'members') {
                fputcsv($handle, ['Member Code', 'First Name', 'Last Name', 'Phone', 'Email', 'Status', 'Branch', 'Joined Date', 'Billed', 'Paid', 'Outstanding Balance']);
                Member::with('primaryBranch')->chunk(200, function ($members) use ($handle) {
                    foreach ($members as $m) {
                        fputcsv($handle, [
                            $m->member_code,
                            $m->first_name,
                            $m->last_name,
                            $m->phone,
                            $m->email,
                            $m->status,
                            $m->primaryBranch?->name,
                            $m->joined_date?->toDateString(),
                            $m->total_fees_billed,
                            $m->total_fees_paid,
                            $m->outstanding_balance,
                        ]);
                    }
                });
            } elseif ($type === 'payments') {
                fputcsv($handle, ['Receipt Number', 'Date', 'Member Code', 'Member Name', 'Type', 'Amount', 'Method', 'Reference ID', 'Branch']);
                Payment::with(['member', 'branch'])->chunk(200, function ($payments) use ($handle) {
                    foreach ($payments as $p) {
                        fputcsv($handle, [
                            $p->receipt_number,
                            $p->payment_date?->toDateString(),
                            $p->member?->member_code,
                            $p->member?->full_name,
                            $p->type,
                            $p->amount,
                            strtoupper($p->payment_method),
                            $p->reference_id,
                            $p->branch?->name,
                        ]);
                    }
                });
            } elseif ($type === 'expenses') {
                fputcsv($handle, ['Title', 'Category', 'Date', 'Amount', 'Payment Mode', 'Vendor / Paid To', 'Branch']);
                Expense::with('branch')->chunk(200, function ($expenses) use ($handle) {
                    foreach ($expenses as $e) {
                        fputcsv($handle, [
                            $e->title,
                            ucwords(str_replace('_', ' ', $e->category)),
                            $e->expense_date?->toDateString(),
                            $e->amount,
                            strtoupper($e->payment_mode),
                            $e->vendor_name,
                            $e->branch?->name,
                        ]);
                    }
                });
            } elseif ($type === 'leads') {
                fputcsv($handle, ['Name', 'Phone', 'Source', 'Status', 'Follow-up Date', 'Assigned To', 'Branch']);
                Lead::with(['branch', 'assignedUser'])->chunk(200, function ($leads) use ($handle) {
                    foreach ($leads as $l) {
                        fputcsv($handle, [
                            $l->name,
                            $l->phone,
                            $l->source,
                            $l->status,
                            $l->followup_date?->toDateString(),
                            $l->assignedUser?->name,
                            $l->branch?->name,
                        ]);
                    }
                });
            } elseif ($type === 'dues') {
                fputcsv($handle, ['Member Code', 'Name', 'Phone', 'Branch', 'Billed', 'Paid', 'Outstanding Due']);
                Member::where('outstanding_balance', '>', 0)->with('primaryBranch')->chunk(200, function ($members) use ($handle) {
                    foreach ($members as $m) {
                        fputcsv($handle, [
                            $m->member_code,
                            $m->full_name,
                            $m->phone,
                            $m->primaryBranch?->name,
                            $m->total_fees_billed,
                            $m->total_fees_paid,
                            $m->outstanding_balance,
                        ]);
                    }
                });
            }

            fclose($handle);
        }, 200, $headers);
    }
}
