<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AttendanceLog;
use App\Models\Branch;
use App\Models\Expense;
use App\Models\Lead;
use App\Models\Member;
use App\Models\MemberMembership;
use App\Models\Payment;
use App\Models\PosOrder;
use App\Models\PosOrderItem;
use App\Models\ProductBranchStock;
use App\Support\CurrentBranch;
use App\Support\CurrentGym;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OwnerDashboardController extends Controller
{
    public function __invoke(Request $request)
    {
        $gymId = CurrentGym::require();
        $branchId = $request->query('branch_id') ?: CurrentBranch::id();
        $period = $request->query('period', 'this_month');

        // Determine date range based on period filter
        $now = Carbon::now();
        switch ($period) {
            case 'today':
                $from = $now->copy()->startOfDay()->toDateString();
                $to = $now->copy()->endOfDay()->toDateString();
                $prevFrom = $now->copy()->subDay()->startOfDay()->toDateString();
                $prevTo = $now->copy()->subDay()->endOfDay()->toDateString();
                break;
            case 'yesterday':
                $from = $now->copy()->subDay()->startOfDay()->toDateString();
                $to = $now->copy()->subDay()->endOfDay()->toDateString();
                $prevFrom = $now->copy()->subDays(2)->startOfDay()->toDateString();
                $prevTo = $now->copy()->subDays(2)->endOfDay()->toDateString();
                break;
            case 'this_week':
                $from = $now->copy()->startOfWeek()->toDateString();
                $to = $now->copy()->endOfWeek()->toDateString();
                $prevFrom = $now->copy()->subWeek()->startOfWeek()->toDateString();
                $prevTo = $now->copy()->subWeek()->endOfWeek()->toDateString();
                break;
            case 'custom':
                $from = $request->query('from', $now->copy()->startOfMonth()->toDateString());
                $to = $request->query('to', $now->copy()->toDateString());
                $days = Carbon::parse($from)->diffInDays(Carbon::parse($to)) ?: 1;
                $prevFrom = Carbon::parse($from)->subDays($days)->toDateString();
                $prevTo = Carbon::parse($from)->subDay()->toDateString();
                break;
            case 'this_month':
            default:
                $from = $now->copy()->startOfMonth()->toDateString();
                $to = $now->copy()->endOfMonth()->toDateString();
                $prevFrom = $now->copy()->subMonth()->startOfMonth()->toDateString();
                $prevTo = $now->copy()->subMonth()->endOfMonth()->toDateString();
                break;
        }

        // 1. Members metrics
        $membersQuery = Member::where('gym_id', $gymId);
        if ($branchId) {
            $membersQuery->where('primary_branch_id', $branchId);
        }
        $totalMembers = (clone $membersQuery)->count();
        $activeMembers = (clone $membersQuery)->where('status', 'active')->count();

        $newMembers = (clone $membersQuery)
            ->whereBetween('joined_date', [$from, $to])
            ->count();

        $expiringMemberships = MemberMembership::where('gym_id', $gymId)
            ->where('status', 'active')
            ->whereBetween('end_date', [$now->toDateString(), $now->copy()->addDays(7)->toDateString()])
            ->when($branchId, fn($q) => $q->where('branch_id', $branchId))
            ->count();

        // 2. Attendance & Live Occupancy
        $attendanceQuery = AttendanceLog::where('gym_id', $gymId)
            ->whereDate('check_in_at', $now->toDateString());
        if ($branchId) {
            $attendanceQuery->where('branch_id', $branchId);
        }
        $todayAttendance = (clone $attendanceQuery)->count();
        $currentlyInside = (clone $attendanceQuery)->whereNull('check_out_at')->count();

        // 3. Membership & Financial Collections
        $paymentQuery = Payment::where('gym_id', $gymId)
            ->where('status', 'completed')
            ->where('type', 'payment')
            ->whereBetween('payment_date', [$from, $to]);
        if ($branchId) {
            $paymentQuery->where('branch_id', $branchId);
        }
        $membershipCollections = (float) $paymentQuery->sum('amount');

        // Total Outstanding dues across members
        $outstandingDues = (float) Member::where('gym_id', $gymId)
            ->when($branchId, fn($q) => $q->where('primary_branch_id', $branchId))
            ->sum('outstanding_balance');

        // 4. Supplement Sales & COGS & Gross Margin
        $posOrdersQuery = PosOrder::where('gym_id', $gymId)
            ->where('status', '!=', 'cancelled')
            ->whereBetween('order_date', [$from, $to]);
        if ($branchId) {
            $posOrdersQuery->where('branch_id', $branchId);
        }
        $supplementRevenue = (float) $posOrdersQuery->sum('total_amount');
        $supplementCollected = (float) $posOrdersQuery->sum('paid_amount');

        $cogsQuery = PosOrderItem::join('pos_orders', 'pos_order_items.pos_order_id', '=', 'pos_orders.id')
            ->where('pos_orders.gym_id', $gymId)
            ->where('pos_orders.status', '!=', 'cancelled')
            ->whereBetween('pos_orders.order_date', [$from, $to]);
        if ($branchId) {
            $cogsQuery->where('pos_orders.branch_id', $branchId);
        }
        $supplementCogs = (float) $cogsQuery->sum(DB::raw('pos_order_items.quantity * pos_order_items.unit_cost_at_sale'));
        $supplementGrossProfit = round($supplementRevenue - $supplementCogs, 2);
        $supplementGrossMarginPercent = $supplementRevenue > 0
            ? round(($supplementGrossProfit / $supplementRevenue) * 100, 1)
            : 0.0;

        // 5. Operating Expenses
        $expenseQuery = Expense::where('gym_id', $gymId)
            ->whereBetween('expense_date', [$from, $to]);
        if ($branchId) {
            $expenseQuery->where('branch_id', $branchId);
        }
        $totalExpenses = (float) $expenseQuery->sum('amount');

        // 6. Net Operating Profit: (Membership Collections + Supplement Gross Profit) - Operating Expenses
        $totalGrossIncome = $membershipCollections + $supplementGrossProfit;
        $operatingProfit = round($totalGrossIncome - $totalExpenses, 2);
        $operatingMarginPercent = ($membershipCollections + $supplementRevenue) > 0
            ? round(($operatingProfit / ($membershipCollections + $supplementRevenue)) * 100, 1)
            : 0.0;

        // 7. Leads & Conversion Rate
        $leadsQuery = Lead::where('gym_id', $gymId)
            ->whereBetween('created_at', [$from, $to . ' 23:59:59']);
        if ($branchId) {
            $leadsQuery->where('branch_id', $branchId);
        }
        $totalLeads = (clone $leadsQuery)->count();
        $convertedLeads = (clone $leadsQuery)->where('status', 'converted')->count();
        $conversionRate = $totalLeads > 0 ? round(($convertedLeads / $totalLeads) * 100, 1) : 0.0;

        // 8. Branch Performance Comparison
        $branches = Branch::where('gym_id', $gymId)
            ->where('is_active', true)
            ->get()
            ->map(function ($b) use ($gymId, $from, $to) {
                $bMembers = Member::where('gym_id', $gymId)->where('primary_branch_id', $b->id)->where('status', 'active')->count();
                $bCollections = (float) Payment::where('gym_id', $gymId)->where('branch_id', $b->id)->where('status', 'completed')->where('type', 'payment')->whereBetween('payment_date', [$from, $to])->sum('amount');
                $bSupplements = (float) PosOrder::where('gym_id', $gymId)->where('branch_id', $b->id)->where('status', '!=', 'cancelled')->whereBetween('order_date', [$from, $to])->sum('total_amount');
                $bExpenses = (float) Expense::where('gym_id', $gymId)->where('branch_id', $b->id)->whereBetween('expense_date', [$from, $to])->sum('amount');
                $bProfit = round(($bCollections + $bSupplements) - $bExpenses, 2);

                return [
                    'id' => $b->id,
                    'name' => $b->name,
                    'code' => $b->code,
                    'active_members' => $bMembers,
                    'collections' => $bCollections,
                    'supplement_sales' => $bSupplements,
                    'expenses' => $bExpenses,
                    'operating_profit' => $bProfit,
                ];
            });

        // 9. Comparison with Previous Period (Trend percentage)
        $prevCollections = (float) Payment::where('gym_id', $gymId)
            ->where('status', 'completed')
            ->where('type', 'payment')
            ->whereBetween('payment_date', [$prevFrom, $prevTo])
            ->when($branchId, fn($q) => $q->where('branch_id', $branchId))
            ->sum('amount');

        $revenueGrowthPercent = $prevCollections > 0
            ? round((($membershipCollections - $prevCollections) / $prevCollections) * 100, 1)
            : 0.0;

        return response()->json([
            'period' => $period,
            'date_range' => ['from' => $from, 'to' => $to],
            'executive_kpis' => [
                'total_members' => $totalMembers,
                'active_members' => $activeMembers,
                'new_members' => $newMembers,
                'expiring_memberships' => $expiringMemberships,
                'today_attendance' => $todayAttendance,
                'currently_inside' => $currentlyInside,
                'membership_collections' => $membershipCollections,
                'revenue_growth_percent' => $revenueGrowthPercent,
                'outstanding_dues' => round($outstandingDues, 2),
                'supplement_sales' => round($supplementRevenue, 2),
                'supplement_collections' => round($supplementCollected, 2),
                'supplement_cogs' => round($supplementCogs, 2),
                'supplement_gross_profit' => $supplementGrossProfit,
                'supplement_gross_margin_percent' => $supplementGrossMarginPercent,
                'total_expenses' => round($totalExpenses, 2),
                'operating_profit' => $operatingProfit,
                'operating_margin_percent' => $operatingMarginPercent,
                'total_leads' => $totalLeads,
                'converted_leads' => $convertedLeads,
                'conversion_rate' => $conversionRate,
            ],
            'branches' => $branches,
        ]);
    }
}
