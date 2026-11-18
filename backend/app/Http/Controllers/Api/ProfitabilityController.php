<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryMovement;
use App\Models\PosOrder;
use App\Models\PosOrderItem;
use App\Models\Product;
use App\Models\ProductBranchStock;
use App\Models\Supplier;
use App\Support\CurrentBranch;
use App\Support\CurrentGym;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProfitabilityController extends Controller
{
    /**
     * Costing Method: Weighted Average Cost (WAC)
     * Every purchase calculates new WAC:
     *   WAC = ((Current_Stock * Current_WAC) + (New_Purchase_Qty * Purchase_Unit_Price)) / (Current_Stock + New_Purchase_Qty)
     * Exact unit cost is frozen onto pos_order_items.unit_cost_at_sale at time of sale.
     */
    public function overview(Request $request)
    {
        $gymId = CurrentGym::require();
        $branchId = $request->query('branch_id') ?: CurrentBranch::id();

        $from = $request->query('from', Carbon::now()->startOfMonth()->toDateString());
        $to = $request->query('to', Carbon::now()->endOfMonth()->toDateString());

        // 1. Current Inventory Valuation (WAC based)
        $stockQuery = ProductBranchStock::where('gym_id', $gymId);
        if ($branchId) {
            $stockQuery->where('branch_id', $branchId);
        }
        $totalStockUnits = (int) $stockQuery->sum('quantity');
        $totalCostValuation = (float) $stockQuery->sum(DB::raw('quantity * cost_price'));
        $totalRetailValuation = (float) $stockQuery->sum(DB::raw('quantity * selling_price'));
        $unrealizedMargin = max(0, $totalRetailValuation - $totalCostValuation);

        // 2. Sales and COGS in Date Range
        $ordersQuery = PosOrder::where('gym_id', $gymId)
            ->where('status', '!=', 'cancelled')
            ->whereBetween('order_date', [$from, $to]);

        if ($branchId) {
            $ordersQuery->where('branch_id', $branchId);
        }

        $supplementRevenue = (float) $ordersQuery->sum('total_amount');
        $supplementCollections = (float) $ordersQuery->sum('paid_amount');
        $supplementDues = (float) $ordersQuery->sum('balance_due');

        // COGS query using unit_cost_at_sale
        $cogsQuery = PosOrderItem::join('pos_orders', 'pos_order_items.pos_order_id', '=', 'pos_orders.id')
            ->where('pos_orders.gym_id', $gymId)
            ->where('pos_orders.status', '!=', 'cancelled')
            ->whereBetween('pos_orders.order_date', [$from, $to]);

        if ($branchId) {
            $cogsQuery->where('pos_orders.branch_id', $branchId);
        }

        $cogs = (float) $cogsQuery->sum(DB::raw('pos_order_items.quantity * pos_order_items.unit_cost_at_sale'));
        $grossProfit = round($supplementRevenue - $cogs, 2);
        $grossMarginPercent = $supplementRevenue > 0 ? round(($grossProfit / $supplementRevenue) * 100, 2) : 0.0;

        // 3. Today's Revenue and COGS
        $today = Carbon::today()->toDateString();
        $todayOrders = PosOrder::where('gym_id', $gymId)
            ->where('status', '!=', 'cancelled')
            ->whereDate('order_date', $today);
        if ($branchId) {
            $todayOrders->where('branch_id', $branchId);
        }
        $todayRevenue = (float) $todayOrders->sum('total_amount');

        // 4. Stock Losses (Damaged & Expired write-offs)
        $lossQuery = InventoryMovement::where('gym_id', $gymId)
            ->whereIn('type', ['damaged', 'expired'])
            ->whereBetween(DB::raw('DATE(created_at)'), [$from, $to]);
        if ($branchId) {
            $lossQuery->where('branch_id', $branchId);
        }
        $stockLossAmount = (float) $lossQuery->sum('total_cost');

        // 5. Outstanding Supplier Dues
        $supplierDues = (float) Supplier::where('gym_id', $gymId)->sum('outstanding_balance');

        // 6. Daily trend (past 14 days)
        $trendStart = Carbon::today()->subDays(13)->toDateString();
        $dailyData = PosOrder::where('gym_id', $gymId)
            ->where('status', '!=', 'cancelled')
            ->whereDate('order_date', '>=', $trendStart)
            ->selectRaw('order_date, SUM(total_amount) as revenue, SUM(paid_amount) as collected, COUNT(id) as order_count')
            ->groupBy('order_date')
            ->orderBy('order_date', 'asc')
            ->get();

        return response()->json([
            'costing_method' => 'Weighted Average Cost (WAC)',
            'date_range' => ['from' => $from, 'to' => $to],
            'kpis' => [
                'total_stock_units' => $totalStockUnits,
                'inventory_cost_valuation' => round($totalCostValuation, 2),
                'inventory_retail_valuation' => round($totalRetailValuation, 2),
                'unrealized_potential_profit' => round($unrealizedMargin, 2),
                'today_revenue' => round($todayRevenue, 2),
                'period_supplement_revenue' => round($supplementRevenue, 2),
                'period_cogs' => round($cogs, 2),
                'period_gross_profit' => $grossProfit,
                'period_gross_margin_percent' => $grossMarginPercent,
                'stock_loss_write_off' => round($stockLossAmount, 2),
                'period_collections' => round($supplementCollections, 2),
                'period_outstanding_dues' => round($supplementDues, 2),
                'supplier_outstanding_dues' => round($supplierDues, 2),
            ],
            'daily_trend' => $dailyData,
        ]);
    }

    public function productPerformance(Request $request)
    {
        $gymId = CurrentGym::require();
        $branchId = $request->query('branch_id') ?: CurrentBranch::id();
        $from = $request->query('from', Carbon::now()->startOfMonth()->toDateString());
        $to = $request->query('to', Carbon::now()->endOfMonth()->toDateString());

        // Get sales aggregated per product
        $salesQuery = DB::table('pos_order_items')
            ->join('pos_orders', 'pos_order_items.pos_order_id', '=', 'pos_orders.id')
            ->join('products', 'pos_order_items.product_id', '=', 'products.id')
            ->where('pos_orders.gym_id', $gymId)
            ->where('pos_orders.status', '!=', 'cancelled')
            ->whereBetween('pos_orders.order_date', [$from, $to]);

        if ($branchId) {
            $salesQuery->where('pos_orders.branch_id', $branchId);
        }

        $sales = $salesQuery->groupBy(
            'products.id',
            'products.name',
            'products.brand',
            'products.category',
            'products.sku',
            'products.cost_price',
            'products.selling_price'
        )
        ->select([
            'products.id as product_id',
            'products.name as product_name',
            'products.brand',
            'products.category',
            'products.sku',
            DB::raw('SUM(pos_order_items.quantity) as units_sold'),
            DB::raw('SUM(pos_order_items.total_amount) as total_revenue'),
            DB::raw('SUM(pos_order_items.quantity * pos_order_items.unit_cost_at_sale) as total_cogs'),
            DB::raw('SUM(pos_order_items.total_amount) - SUM(pos_order_items.quantity * pos_order_items.unit_cost_at_sale) as gross_profit'),
        ])
        ->orderByDesc('total_revenue')
        ->get()
        ->map(function ($row) {
            $revenue = (float) $row->total_revenue;
            $cogs = (float) $row->total_cogs;
            $profit = (float) $row->gross_profit;
            $marginPct = $revenue > 0 ? round(($profit / $revenue) * 100, 2) : 0.0;

            return [
                'product_id' => $row->product_id,
                'product_name' => $row->product_name,
                'brand' => $row->brand,
                'category' => $row->category,
                'sku' => $row->sku,
                'units_sold' => (int) $row->units_sold,
                'total_revenue' => round($revenue, 2),
                'total_cogs' => round($cogs, 2),
                'gross_profit' => round($profit, 2),
                'gross_margin_percent' => $marginPct,
            ];
        });

        return response()->json([
            'performance' => $sales,
        ]);
    }

    public function slowMoving(Request $request)
    {
        $gymId = CurrentGym::require();
        $branchId = $request->query('branch_id') ?: CurrentBranch::id();
        $days = (int) $request->query('days', 30);
        $thresholdDate = Carbon::today()->subDays($days)->toDateString();

        // Products with stock > 0 that have zero sales since thresholdDate
        $stockQuery = ProductBranchStock::join('products', 'product_branch_stocks.product_id', '=', 'products.id')
            ->join('branches', 'product_branch_stocks.branch_id', '=', 'branches.id')
            ->where('product_branch_stocks.gym_id', $gymId)
            ->where('product_branch_stocks.quantity', '>', 0)
            ->where('products.is_active', true);

        if ($branchId) {
            $stockQuery->where('product_branch_stocks.branch_id', $branchId);
        }

        $allInStock = $stockQuery->select([
            'products.id as product_id',
            'products.name as product_name',
            'products.brand',
            'products.category',
            'products.sku',
            'product_branch_stocks.branch_id',
            'branches.name as branch_name',
            'product_branch_stocks.quantity',
            'product_branch_stocks.cost_price',
            'product_branch_stocks.selling_price',
            DB::raw('product_branch_stocks.quantity * product_branch_stocks.cost_price as capital_tied_up'),
        ])->get();

        $activeProductIds = DB::table('pos_order_items')
            ->join('pos_orders', 'pos_order_items.pos_order_id', '=', 'pos_orders.id')
            ->where('pos_orders.gym_id', $gymId)
            ->where('pos_orders.status', '!=', 'cancelled')
            ->whereDate('pos_orders.order_date', '>=', $thresholdDate)
            ->pluck('pos_order_items.product_id')
            ->unique()
            ->toArray();

        $slowMoving = $allInStock->filter(function ($item) use ($activeProductIds) {
            return !in_array($item->product_id, $activeProductIds);
        })->values();

        return response()->json([
            'threshold_days' => $days,
            'slow_moving_count' => $slowMoving->count(),
            'total_capital_tied_up' => round($slowMoving->sum('capital_tied_up'), 2),
            'items' => $slowMoving,
        ]);
    }

    public function stockLoss(Request $request)
    {
        $gymId = CurrentGym::require();
        $branchId = $request->query('branch_id') ?: CurrentBranch::id();

        $query = InventoryMovement::with([
            'product:id,name,brand,sku,category',
            'branch:id,name',
            'user:id,name',
        ])
        ->where('gym_id', $gymId)
        ->whereIn('type', ['damaged', 'expired']);

        if ($branchId) {
            $query->where('branch_id', $branchId);
        }

        if ($request->filled('from')) {
            $query->whereDate('created_at', '>=', $request->query('from'));
        }

        if ($request->filled('to')) {
            $query->whereDate('created_at', '<=', $request->query('to'));
        }

        $losses = $query->latest('id')->paginate((int) $request->query('per_page', 25));
        $totalLoss = (clone $query)->sum('total_cost');

        return response()->json([
            'losses' => $losses,
            'total_loss_amount' => round((float) $totalLoss, 2),
        ]);
    }

    public function branchMatrix(Request $request)
    {
        $gymId = CurrentGym::require();
        $from = $request->query('from', Carbon::now()->startOfMonth()->toDateString());
        $to = $request->query('to', Carbon::now()->endOfMonth()->toDateString());

        $branches = DB::table('branches')
            ->where('gym_id', $gymId)
            ->where('is_active', true)
            ->get();

        $matrix = $branches->map(function ($branch) use ($gymId, $from, $to) {
            $revenue = (float) PosOrder::where('branch_id', $branch->id)
                ->where('status', '!=', 'cancelled')
                ->whereBetween('order_date', [$from, $to])
                ->sum('total_amount');

            $cogs = (float) PosOrderItem::join('pos_orders', 'pos_order_items.pos_order_id', '=', 'pos_orders.id')
                ->where('pos_orders.branch_id', $branch->id)
                ->where('pos_orders.status', '!=', 'cancelled')
                ->whereBetween('pos_orders.order_date', [$from, $to])
                ->sum(DB::raw('pos_order_items.quantity * pos_order_items.unit_cost_at_sale'));

            $grossProfit = round($revenue - $cogs, 2);
            $marginPct = $revenue > 0 ? round(($grossProfit / $revenue) * 100, 2) : 0.0;

            $stockValuation = (float) ProductBranchStock::where('branch_id', $branch->id)
                ->sum(DB::raw('quantity * cost_price'));

            $stockUnits = (int) ProductBranchStock::where('branch_id', $branch->id)->sum('quantity');

            return [
                'branch_id' => $branch->id,
                'branch_name' => $branch->name,
                'branch_code' => $branch->code,
                'revenue' => round($revenue, 2),
                'cogs' => round($cogs, 2),
                'gross_profit' => $grossProfit,
                'gross_margin_percent' => $marginPct,
                'stock_units' => $stockUnits,
                'stock_valuation' => round($stockValuation, 2),
            ];
        });

        return response()->json([
            'matrix' => $matrix,
        ]);
    }
}
