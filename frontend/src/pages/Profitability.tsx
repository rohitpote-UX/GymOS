import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  DollarSign,
  Info,
  Layers,
  Package,
  Percent,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface OverviewKpis {
  total_stock_units: number;
  inventory_cost_valuation: number;
  inventory_retail_valuation: number;
  unrealized_potential_profit: number;
  today_revenue: number;
  period_supplement_revenue: number;
  period_cogs: number;
  period_gross_profit: number;
  period_gross_margin_percent: number;
  stock_loss_write_off: number;
  period_collections: number;
  period_outstanding_dues: number;
  supplier_outstanding_dues: number;
}

interface ProductPerf {
  product_id: number;
  product_name: string;
  brand: string | null;
  category: string;
  sku: string | null;
  units_sold: number;
  total_revenue: number;
  total_cogs: number;
  gross_profit: number;
  gross_margin_percent: number;
}

interface SlowMovingItem {
  product_id: number;
  product_name: string;
  brand: string | null;
  category: string;
  quantity: number;
  cost_price: string | number;
  capital_tied_up: number;
}

interface BranchMetric {
  branch_id: number;
  branch_name: string;
  branch_code: string;
  revenue: number;
  cogs: number;
  gross_profit: number;
  gross_margin_percent: number;
  stock_units: number;
  stock_valuation: number;
}

export const Profitability: React.FC = () => {
  const { activeBranchId } = useAuth();
  const [loading, setLoading] = useState(true);

  // Date range
  const today = new Date().toISOString().split('T')[0];
  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .split('T')[0];

  const [dateRange, setDateRange] = useState({
    from: firstDayOfMonth,
    to: today,
  });

  const [kpis, setKpis] = useState<OverviewKpis | null>(null);
  const [dailyTrend, setDailyTrend] = useState<any[]>([]);
  const [productsPerf, setProductsPerf] = useState<ProductPerf[]>([]);
  const [slowMoving, setSlowMoving] = useState<{ count: number; capital: number; items: SlowMovingItem[] }>({
    count: 0,
    capital: 0,
    items: [],
  });
  const [losses, setLosses] = useState<{ total: number; list: any[] }>({ total: 0, list: [] });
  const [branchMatrix, setBranchMatrix] = useState<BranchMetric[]>([]);

  const fetchProfitabilityData = async () => {
    try {
      setLoading(true);
      const params = {
        branch_id: activeBranchId,
        from: dateRange.from,
        to: dateRange.to,
      };

      const [overviewRes, perfRes, slowRes, lossRes, matrixRes] = await Promise.all([
        api.get('/profitability/overview', { params }),
        api.get('/profitability/product-performance', { params }),
        api.get('/profitability/slow-moving', { params }),
        api.get('/profitability/stock-loss', { params }),
        api.get('/profitability/branch-matrix', { params }),
      ]);

      setKpis(overviewRes.data.kpis);
      setDailyTrend(overviewRes.data.daily_trend || []);
      setProductsPerf(perfRes.data.performance || []);
      setSlowMoving({
        count: slowRes.data.slow_moving_count || 0,
        capital: slowRes.data.total_capital_tied_up || 0,
        items: slowRes.data.items || [],
      });
      setLosses({
        total: lossRes.data.total_loss_amount || 0,
        list: lossRes.data.losses?.data || [],
      });
      setBranchMatrix(matrixRes.data.matrix || []);
    } catch (err) {
      console.error('Failed to load profitability metrics', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfitabilityData();
  }, [activeBranchId, dateRange.from, dateRange.to]);

  const handleQuickPeriod = (type: 'this_month' | 'last_30') => {
    if (type === 'this_month') {
      setDateRange({ from: firstDayOfMonth, to: today });
    } else {
      const past30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      setDateRange({ from: past30, to: today });
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <TrendingUp className="w-7 h-7 text-emerald-400" />
            Supplement Profitability & COGS Engine
          </h1>
          <p className="text-sm text-slate-400">
            Real-time gross margin, Cost of Goods Sold (COGS), inventory valuation, and dead-stock alerts.
          </p>
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleQuickPeriod('this_month')}
            className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs rounded-lg cursor-pointer"
          >
            This Month
          </button>
          <button
            onClick={() => handleQuickPeriod('last_30')}
            className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs rounded-lg cursor-pointer"
          >
            Last 30 Days
          </button>
          <button
            onClick={fetchProfitabilityData}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
            title="Refresh analytics"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Costing Method Banner */}
      <div className="p-3 bg-blue-950/40 border border-blue-500/30 rounded-xl text-xs text-blue-300 flex items-center gap-2.5">
        <Info className="w-4 h-4 text-blue-400 shrink-0" />
        <span>
          <strong>Inventory Costing Standard: Weighted Average Cost (WAC).</strong> Every stock purchase automatically
          recomputes average unit cost. Real-time POS checkout freezes COGS at exact point-of-sale acquisition rates.
        </span>
      </div>

      {/* Primary Financial Metric Cards */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1">
            <span className="text-xs text-slate-400">Supplement Revenue</span>
            <div className="text-2xl font-extrabold text-white">₹{kpis.period_supplement_revenue.toLocaleString('en-IN')}</div>
            <div className="text-[11px] text-emerald-400 font-medium">
              Collected: ₹{kpis.period_collections.toLocaleString('en-IN')}
            </div>
          </div>

          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1">
            <span className="text-xs text-slate-400">Cost of Goods Sold (COGS)</span>
            <div className="text-2xl font-extrabold text-slate-300">₹{kpis.period_cogs.toLocaleString('en-IN')}</div>
            <div className="text-[11px] text-slate-500 font-medium">Product acquisition cost</div>
          </div>

          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1">
            <span className="text-xs text-slate-400">Gross Profit</span>
            <div className="text-2xl font-extrabold text-emerald-400">₹{kpis.period_gross_profit.toLocaleString('en-IN')}</div>
            <div className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5" /> Margin: {kpis.period_gross_margin_percent}%
            </div>
          </div>

          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1">
            <span className="text-xs text-slate-400">Stock Valuation (Cost)</span>
            <div className="text-2xl font-extrabold text-amber-400">₹{kpis.inventory_cost_valuation.toLocaleString('en-IN')}</div>
            <div className="text-[11px] text-slate-400">
              Retail MRP: ₹{kpis.inventory_retail_valuation.toLocaleString('en-IN')}
            </div>
          </div>
        </div>
      )}

      {/* Secondary Quick Metrics */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-slate-900/40 border border-slate-800/80 rounded-lg flex items-center justify-between">
            <span className="text-slate-400">Today's Sales</span>
            <span className="font-bold text-white">₹{kpis.today_revenue.toLocaleString('en-IN')}</span>
          </div>

          <div className="p-3 bg-slate-900/40 border border-slate-800/80 rounded-lg flex items-center justify-between">
            <span className="text-slate-400">Unrealized Stock Profit</span>
            <span className="font-bold text-emerald-400">₹{kpis.unrealized_potential_profit.toLocaleString('en-IN')}</span>
          </div>

          <div className="p-3 bg-slate-900/40 border border-slate-800/80 rounded-lg flex items-center justify-between">
            <span className="text-slate-400">Damaged/Expired Write-Off</span>
            <span className="font-bold text-rose-400">₹{kpis.stock_loss_write_off.toLocaleString('en-IN')}</span>
          </div>

          <div className="p-3 bg-slate-900/40 border border-slate-800/80 rounded-lg flex items-center justify-between">
            <span className="text-slate-400">Supplier Dues</span>
            <span className="font-bold text-amber-400">₹{kpis.supplier_outstanding_dues.toLocaleString('en-IN')}</span>
          </div>
        </div>
      )}

      {/* Product-Level Profitability Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-xl space-y-3">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            Product Sales, COGS & Gross Margin Matrix
          </h3>
          <span className="text-xs text-slate-400">{productsPerf.length} Products Sold in Period</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="p-3">Product Name</th>
                <th className="p-3">Category</th>
                <th className="p-3 text-center">Units Sold</th>
                <th className="p-3 text-right">Revenue (₹)</th>
                <th className="p-3 text-right">COGS (₹)</th>
                <th className="p-3 text-right">Gross Profit (₹)</th>
                <th className="p-3 text-right">Margin %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-400" />
                    Calculating product margins...
                  </td>
                </tr>
              ) : productsPerf.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No product sales recorded in this date range.
                  </td>
                </tr>
              ) : (
                productsPerf.map((prod) => (
                  <tr key={prod.product_id} className="hover:bg-slate-800/30">
                    <td className="p-3">
                      <div className="font-semibold text-white">{prod.product_name}</div>
                      <div className="text-[11px] text-slate-500">{prod.brand || 'No Brand'} {prod.sku ? `• ${prod.sku}` : ''}</div>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-slate-800 rounded text-[11px] text-slate-300 capitalize">
                        {prod.category.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-3 text-center font-bold text-white">{prod.units_sold}</td>
                    <td className="p-3 text-right font-medium text-white">₹{prod.total_revenue.toFixed(2)}</td>
                    <td className="p-3 text-right text-slate-400">₹{prod.total_cogs.toFixed(2)}</td>
                    <td className="p-3 text-right font-bold text-emerald-400">₹{prod.gross_profit.toFixed(2)}</td>
                    <td className="p-3 text-right">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                          prod.gross_margin_percent >= 30
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : prod.gross_margin_percent >= 15
                            ? 'bg-blue-500/20 text-blue-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {prod.gross_margin_percent}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grid: Slow-Moving Stock & Stock Write-offs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Slow-Moving Stock Alert */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Slow-Moving Stock (&gt;30 Days)
              </h3>
              <p className="text-[11px] text-slate-500">Products in stock with zero sales in the last 30 days</p>
            </div>
            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 text-xs font-bold rounded">
              {slowMoving.count} items
            </span>
          </div>

          <div className="space-y-2 max-h-[280px] overflow-y-auto text-xs pr-1">
            {slowMoving.items.length === 0 ? (
              <div className="text-center py-8 text-slate-500">No stagnant or slow-moving stock detected. Good turnover!</div>
            ) : (
              slowMoving.items.map((item) => (
                <div key={item.product_id} className="p-2.5 bg-slate-950/60 border border-slate-800 rounded-lg flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-white">{item.product_name}</div>
                    <div className="text-[11px] text-slate-500">{item.brand || item.category} • {item.quantity} units in stock</div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-amber-400">₹{parseFloat(item.capital_tied_up as any).toFixed(2)}</span>
                    <div className="text-[10px] text-slate-500">Capital tied up</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Expired and Damaged Stock Loss */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4 text-rose-400" />
                Damaged & Expired Loss Write-Offs
              </h3>
              <p className="text-[11px] text-slate-500">Recorded inventory write-offs and breakage</p>
            </div>
            <span className="text-xs font-bold text-rose-400">
              Total: ₹{losses.total.toFixed(2)}
            </span>
          </div>

          <div className="space-y-2 max-h-[280px] overflow-y-auto text-xs pr-1">
            {losses.list.length === 0 ? (
              <div className="text-center py-8 text-slate-500">No stock write-offs recorded in this period.</div>
            ) : (
              losses.list.map((loss) => (
                <div key={loss.id} className="p-2.5 bg-slate-950/60 border border-slate-800 rounded-lg flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-white">{loss.product?.name}</div>
                    <div className="text-[11px] text-slate-500">
                      Reason: <span className="text-slate-300">{loss.notes || loss.type}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-rose-400">-₹{parseFloat(loss.total_cost).toFixed(2)}</span>
                    <div className="text-[10px] text-slate-500">{Math.abs(loss.quantity_change)} units</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Multi-Branch Comparison Matrix */}
      {branchMatrix.length > 1 && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-xl space-y-3">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-400" />
              Cross-Branch Supplement Performance Matrix
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3">Branch</th>
                  <th className="p-3 text-right">Supplement Revenue (₹)</th>
                  <th className="p-3 text-right">COGS (₹)</th>
                  <th className="p-3 text-right">Gross Profit (₹)</th>
                  <th className="p-3 text-right">Gross Margin %</th>
                  <th className="p-3 text-center">Stock Units</th>
                  <th className="p-3 text-right">Stock Valuation (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {branchMatrix.map((bm) => (
                  <tr key={bm.branch_id} className="hover:bg-slate-800/30">
                    <td className="p-3 font-semibold text-white">
                      {bm.branch_name} <span className="text-slate-500 font-mono">({bm.branch_code})</span>
                    </td>
                    <td className="p-3 text-right font-medium text-white">₹{bm.revenue.toFixed(2)}</td>
                    <td className="p-3 text-right text-slate-400">₹{bm.cogs.toFixed(2)}</td>
                    <td className="p-3 text-right font-bold text-emerald-400">₹{bm.gross_profit.toFixed(2)}</td>
                    <td className="p-3 text-right font-bold text-emerald-400">{bm.gross_margin_percent}%</td>
                    <td className="p-3 text-center text-white">{bm.stock_units}</td>
                    <td className="p-3 text-right font-bold text-amber-400">₹{bm.stock_valuation.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profitability;
