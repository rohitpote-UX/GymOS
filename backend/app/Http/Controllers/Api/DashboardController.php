<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AttendanceLog;
use App\Models\Branch;
use App\Models\Member;
use App\Models\MemberMembership;
use App\Models\Payment;
use App\Models\PosOrder;
use App\Models\PosOrderItem;
use App\Models\ProductBatch;
use App\Models\ProductBranchStock;
use App\Models\Supplier;
use App\Support\CurrentBranch;
use App\Support\CurrentGym;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function __invoke(Request $request)
    {
        $branchId = $request->query('branch_id') ?: CurrentBranch::id();

        // 1. Members
        $membersQuery = Member::query();
        if ($branchId) {
            $membersQuery->where('primary_branch_id', $branchId);
        }
        $totalMembers = (clone $membersQuery)->count();
        $activeMembers = (clone $membersQuery)->where('status', 'active')->count();

        // 2. Expiring Memberships in next 7 days
        $expiringQuery = MemberMembership::with(['member:id,first_name,last_name,phone,member_code', 'plan:id,name'])
            ->where('status', 'active')
            ->whereBetween('end_date', [now()->toDateString(), now()->addDays(7)->toDateString()]);
        if ($branchId) {
            $expiringQuery->where('branch_id', $branchId);
        }
        $expiringMemberships = $expiringQuery->orderBy('end_date')->take(6)->get();

        // 3. Attendance
        $attendanceQuery = AttendanceLog::whereDate('check_in_at', now()->toDateString());
        if ($branchId) {
            $attendanceQuery->where('branch_id', $branchId);
        }
        $todayCheckIns = (clone $attendanceQuery)->count();
        $currentlyInside = (clone $attendanceQuery)->whereNull('check_out_at')->count();

        // 4. Financials
        $paymentQuery = Payment::where('status', 'completed');
        if ($branchId) {
            $paymentQuery->where('branch_id', $branchId);
        }
        $todayRevenue = (clone $paymentQuery)->whereDate('payment_date', now()->toDateString())->sum('amount');
        $thisMonthRevenue = (clone $paymentQuery)->whereBetween('payment_date', [
            now()->startOfMonth()->toDateString(),
            now()->endOfMonth()->toDateString(),
        ])->sum('amount');

        // 5. Recent Payments
        $recentPayments = (clone $paymentQuery)
            ->with(['member:id,first_name,last_name,member_code', 'branch:id,name'])
            ->latest('id')
            ->take(5)
            ->get();

        // 6. Branch Distribution (if multi-branch)
        $branches = Branch::withCount(['members', 'staff'])->get();

        // 7. Inventory & Supplement POS Metrics (Prompt 03)
        $gymId = CurrentGym::require();
        $stockQuery = ProductBranchStock::where('gym_id', $gymId);
        if ($branchId) {
            $stockQuery->where('branch_id', $branchId);
        }
        $stockCostValuation = (float) $stockQuery->sum(DB::raw('quantity * cost_price'));
        $stockRetailValuation = (float) $stockQuery->sum(DB::raw('quantity * selling_price'));

        $lowStockCount = DB::table('products')
            ->join('product_branch_stocks', 'products.id', '=', 'product_branch_stocks.product_id')
            ->where('products.gym_id', $gymId)
            ->where('products.is_active', true)
            ->whereNull('products.deleted_at')
            ->when($branchId, fn($q) => $q->where('product_branch_stocks.branch_id', $branchId))
            ->whereColumn('product_branch_stocks.quantity', '<=', 'products.min_stock_alert')
            ->count();

        $expiringBatchesCount = ProductBatch::where('gym_id', $gymId)
            ->where('current_quantity', '>', 0)
            ->whereNotNull('expiry_date')
            ->whereDate('expiry_date', '<=', Carbon::today()->addDays(30)->toDateString())
            ->when($branchId, fn($q) => $q->where('branch_id', $branchId))
            ->count();

        $todayPosSales = (float) PosOrder::where('gym_id', $gymId)
            ->where('status', '!=', 'cancelled')
            ->whereDate('order_date', now()->toDateString())
            ->when($branchId, fn($q) => $q->where('branch_id', $branchId))
            ->sum('total_amount');

        $monthlyPosSales = (float) PosOrder::where('gym_id', $gymId)
            ->where('status', '!=', 'cancelled')
            ->whereBetween('order_date', [now()->startOfMonth()->toDateString(), now()->endOfMonth()->toDateString()])
            ->when($branchId, fn($q) => $q->where('branch_id', $branchId))
            ->sum('total_amount');

        $monthlyPosCogs = (float) PosOrderItem::join('pos_orders', 'pos_order_items.pos_order_id', '=', 'pos_orders.id')
            ->where('pos_orders.gym_id', $gymId)
            ->where('pos_orders.status', '!=', 'cancelled')
            ->whereBetween('pos_orders.order_date', [now()->startOfMonth()->toDateString(), now()->endOfMonth()->toDateString()])
            ->when($branchId, fn($q) => $q->where('pos_orders.branch_id', $branchId))
            ->sum(DB::raw('pos_order_items.quantity * pos_order_items.unit_cost_at_sale'));

        $monthlyGrossProfit = round($monthlyPosSales - $monthlyPosCogs, 2);
        $monthlyGrossMargin = $monthlyPosSales > 0 ? round(($monthlyGrossProfit / $monthlyPosSales) * 100, 1) : 0.0;

        $supplierDues = (float) Supplier::where('gym_id', $gymId)->sum('outstanding_balance');

        $bestSellers = DB::table('pos_order_items')
            ->join('pos_orders', 'pos_order_items.pos_order_id', '=', 'pos_orders.id')
            ->join('products', 'pos_order_items.product_id', '=', 'products.id')
            ->where('pos_orders.gym_id', $gymId)
            ->where('pos_orders.status', '!=', 'cancelled')
            ->when($branchId, fn($q) => $q->where('pos_orders.branch_id', $branchId))
            ->groupBy('products.id', 'products.name', 'products.brand', 'products.category')
            ->select([
                'products.id',
                'products.name',
                'products.brand',
                'products.category',
                DB::raw('SUM(pos_order_items.quantity) as units_sold'),
                DB::raw('SUM(pos_order_items.total_amount) as total_sales'),
            ])
            ->orderByDesc('units_sold')
            ->take(5)
            ->get();

        return response()->json([
            'metrics' => [
                'total_members' => $totalMembers,
                'active_members' => $activeMembers,
                'today_check_ins' => $todayCheckIns,
                'currently_inside' => $currentlyInside,
                'today_revenue' => (float) $todayRevenue,
                'monthly_revenue' => (float) $thisMonthRevenue,
            ],
            'inventory' => [
                'stock_cost_valuation' => round($stockCostValuation, 2),
                'stock_retail_valuation' => round($stockRetailValuation, 2),
                'low_stock_count' => $lowStockCount,
                'expiring_batches_count' => $expiringBatchesCount,
                'today_sales' => round($todayPosSales, 2),
                'monthly_sales' => round($monthlyPosSales, 2),
                'monthly_cogs' => round($monthlyPosCogs, 2),
                'monthly_gross_profit' => $monthlyGrossProfit,
                'monthly_gross_margin_percent' => $monthlyGrossMargin,
                'supplier_dues' => round($supplierDues, 2),
                'best_sellers' => $bestSellers,
            ],
            'expiring_soon' => $expiringMemberships,
            'recent_payments' => $recentPayments,
            'branches' => $branches,
        ]);
    }
}
