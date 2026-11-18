import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  Barcode,
  Boxes,
  CheckCircle2,
  DollarSign,
  Edit2,
  History,
  Layers,
  Package,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { formatCurrency, formatNumber } from '../lib/formatters';

interface Product {
  id: number;
  name: string;
  brand: string | null;
  category: string;
  sku: string | null;
  barcode: string | null;
  size: string | null;
  weight: string | null;
  flavour: string | null;
  cost_price: string | number;
  selling_price: string | number;
  mrp: string | number;
  tax_percent: string | number;
  min_stock_alert: number;
  is_active: boolean;
  default_supplier?: { id: number; name: string; company_name: string | null };
  branch_stocks?: Array<{ branch_id: number; quantity: number; cost_price: string | number; selling_price: string | number }>;
  batches?: Array<{ id: number; batch_number: string; current_quantity: number; expiry_date: string | null }>;
}

interface Summary {
  total_products: number;
  active_products: number;
  total_stock_units: number;
  total_cost_valuation: number;
  total_retail_valuation: number;
}

const CATEGORIES = [
  { key: 'all', label: 'All Products' },
  { key: 'whey_protein', label: 'Whey Protein' },
  { key: 'mass_gainers', label: 'Mass Gainers' },
  { key: 'creatine', label: 'Creatine' },
  { key: 'pre_workout', label: 'Pre-Workout' },
  { key: 'sports_nutrition', label: 'Sports Nutrition' },
  { key: 'protein_bars', label: 'Protein Bars' },
  { key: 'energy_drinks', label: 'Energy Drinks' },
  { key: 'shakers', label: 'Shakers' },
  { key: 'gym_accessories', label: 'Accessories' },
  { key: 'gym_merchandise', label: 'Apparel & Merch' },
  { key: 'custom', label: 'Custom' },
];

export const Inventory: React.FC = () => {
  const { t } = useTranslation();
  const { user, activeBranchId } = useAuth();
  const branches = user?.branches || [];
  const [products, setProducts] = useState<Product[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [suppliers, setSuppliers] = useState<Array<{ id: number; name: string }>>([]);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showDetailsDrawer, setShowDetailsDrawer] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productDetails, setProductDetails] = useState<any>(null);

  // Form states
  const [form, setForm] = useState({
    name: '',
    brand: '',
    category: 'whey_protein',
    sku: '',
    barcode: '',
    size: '',
    weight: '',
    flavour: '',
    cost_price: '',
    selling_price: '',
    mrp: '',
    tax_percent: '18',
    default_supplier_id: '',
    min_stock_alert: '5',
    opening_stock: '0',
    batch_number: '',
    expiry_date: '',
  });

  const [adjustForm, setAdjustForm] = useState({
    product_id: '',
    adjustment_type: 'damaged',
    quantity_change: '',
    notes: '',
  });

  const [transferForm, setTransferForm] = useState({
    from_branch_id: activeBranchId || '',
    to_branch_id: '',
    product_id: '',
    quantity: '1',
    notes: '',
  });

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params: any = { per_page: 50 };
      if (activeBranchId) params.branch_id = activeBranchId;
      if (selectedCategory !== 'all') params.category = selectedCategory;
      if (search.trim()) params.search = search.trim();

      const res = await api.get('/products', { params });
      setProducts(res.data.products.data || []);
      setSummary(res.data.summary || null);
    } catch (err: any) {
      console.error('Failed to load products', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await api.get('/suppliers', { params: { per_page: 100 } });
      setSuppliers(res.data.suppliers.data || []);
    } catch (err) {
      console.error('Failed to load suppliers', err);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchSuppliers();
  }, [activeBranchId, selectedCategory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProducts();
  };

  const openProductDetails = async (prod: Product) => {
    setSelectedProduct(prod);
    setShowDetailsDrawer(true);
    try {
      const res = await api.get(`/products/${prod.id}`);
      setProductDetails(res.data.product);
    } catch (err) {
      console.error('Failed to load details', err);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      await api.post('/products', {
        ...form,
        cost_price: parseFloat(form.cost_price),
        selling_price: parseFloat(form.selling_price),
        mrp: form.mrp ? parseFloat(form.mrp) : parseFloat(form.selling_price),
        tax_percent: parseFloat(form.tax_percent),
        min_stock_alert: parseInt(form.min_stock_alert, 10),
        opening_stock: parseInt(form.opening_stock, 10),
        branch_id: activeBranchId,
      });

      setShowAddModal(false);
      setActionSuccess('Product registered with stock recorded successfully!');
      fetchProducts();
      // reset form
      setForm({
        name: '',
        brand: '',
        category: 'whey_protein',
        sku: '',
        barcode: '',
        size: '',
        weight: '',
        flavour: '',
        cost_price: '',
        selling_price: '',
        mrp: '',
        tax_percent: '18',
        default_supplier_id: '',
        min_stock_alert: '5',
        opening_stock: '0',
        batch_number: '',
        expiry_date: '',
      });
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setActionError(err.response?.data?.message || 'Failed to create product');
    }
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      await api.post('/inventory/adjust', {
        product_id: parseInt(adjustForm.product_id, 10),
        branch_id: activeBranchId,
        adjustment_type: adjustForm.adjustment_type,
        quantity_change: parseInt(adjustForm.quantity_change, 10),
        notes: adjustForm.notes,
      });

      setShowAdjustModal(false);
      setActionSuccess('Stock adjustment applied and movement recorded.');
      fetchProducts();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setActionError(err.response?.data?.message || err.response?.data?.errors?.quantity_change?.[0] || 'Adjustment failed');
    }
  };

  const handleTransferStock = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      await api.post('/inventory/transfers', {
        from_branch_id: parseInt(transferForm.from_branch_id as string, 10),
        to_branch_id: parseInt(transferForm.to_branch_id, 10),
        items: [
          {
            product_id: parseInt(transferForm.product_id, 10),
            quantity: parseInt(transferForm.quantity, 10),
          },
        ],
        notes: transferForm.notes,
      });

      setShowTransferModal(false);
      setActionSuccess('Stock transfer between branches completed successfully.');
      fetchProducts();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setActionError(err.response?.data?.message || err.response?.data?.errors?.items?.[0] || 'Transfer failed');
    }
  };

  const getStockQty = (prod: Product) => {
    if (prod.branch_stocks && prod.branch_stocks.length > 0) {
      return prod.branch_stocks[0].quantity;
    }
    return 0;
  };

  const filteredProducts = products.filter((p) => {
    if (showLowStockOnly) {
      return getStockQty(p) <= p.min_stock_alert;
    }
    return true;
  });

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Package className="w-7 h-7 text-emerald-400" />
            {t('inventory.title')}
          </h1>
          <p className="text-sm text-slate-400">
            {t('inventory.subtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowAdjustModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4 text-amber-400" />
            Stock Adjustment
          </button>

          <button
            onClick={() => setShowTransferModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors cursor-pointer"
          >
            <ArrowRightLeft className="w-4 h-4 text-blue-400" />
            Branch Transfer
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-bold rounded-lg shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            New Product
          </button>
        </div>
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="p-3 bg-rose-950/60 border border-rose-500/40 rounded-xl text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
            <span className="text-xs text-slate-400">Total Catalog Items</span>
            <div className="text-xl font-bold text-white mt-1">{summary.total_products}</div>
            <span className="text-[11px] text-emerald-400 font-medium">{summary.active_products} Active</span>
          </div>

          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
            <span className="text-xs text-slate-400">Total Units in Stock</span>
            <div className="text-xl font-bold text-emerald-400 mt-1">{summary.total_stock_units}</div>
            <span className="text-[11px] text-slate-500">Across current branch</span>
          </div>

          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
            <span className="text-xs text-slate-400">Cost Valuation (WAC)</span>
            <div className="text-xl font-bold text-white mt-1">{formatCurrency(summary.total_cost_valuation)}</div>
            <span className="text-[11px] text-slate-500">Acquisition cost</span>
          </div>

          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
            <span className="text-xs text-slate-400">Retail Valuation (MRP)</span>
            <div className="text-xl font-bold text-amber-400 mt-1">{formatCurrency(summary.total_retail_valuation)}</div>
            <span className="text-[11px] text-emerald-400 font-medium">
              +{formatCurrency(summary.total_retail_valuation - summary.total_cost_valuation)} profit
            </span>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, brand, SKU or barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-900/80 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
          />
        </form>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setShowLowStockOnly(!showLowStockOnly)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors shrink-0 cursor-pointer ${
              showLowStockOnly
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            ⚠️ Low Stock Alert Only
          </button>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setSelectedCategory(cat.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
              selectedCategory === cat.key
                ? 'bg-emerald-500 text-slate-950 font-bold'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Products Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="p-3">Product</th>
                <th className="p-3">SKU / Barcode</th>
                <th className="p-3">Category</th>
                <th className="p-3 text-center">Branch Stock</th>
                <th className="p-3 text-right">Cost (WAC)</th>
                <th className="p-3 text-right">Selling Price</th>
                <th className="p-3 text-right">GST %</th>
                <th className="p-3">Supplier</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-400" />
                    Loading inventory master...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500">
                    No products found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const stock = getStockQty(p);
                  const isLow = stock <= p.min_stock_alert;

                  return (
                    <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-3">
                        <div className="font-semibold text-white">{p.name}</div>
                        <div className="text-[11px] text-slate-500">
                          {p.brand || 'No Brand'} {p.flavour ? `• ${p.flavour}` : ''} {p.size ? `• ${p.size}` : ''}
                        </div>
                      </td>
                      <td className="p-3 font-mono text-[11px] text-slate-400">
                        {p.sku && <div>{p.sku}</div>}
                        {p.barcode && <div className="text-slate-500">{p.barcode}</div>}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-[11px] text-slate-300 capitalize">
                          {p.category.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                            stock === 0
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : isLow
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {stock} in stock
                        </span>
                        {isLow && <div className="text-[10px] text-rose-400 mt-0.5">Min: {p.min_stock_alert}</div>}
                      </td>
                      <td className="p-3 text-right font-medium text-slate-300">
                        ₹{parseFloat(p.cost_price as string).toFixed(2)}
                      </td>
                      <td className="p-3 text-right font-bold text-white">
                        ₹{parseFloat(p.selling_price as string).toFixed(2)}
                      </td>
                      <td className="p-3 text-right text-slate-400">{p.tax_percent}%</td>
                      <td className="p-3 text-slate-400">{p.default_supplier?.name || '—'}</td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => openProductDetails(p)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700 transition-colors cursor-pointer"
                        >
                          Details & History
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add New Product */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-400" />
                Register New Inventory Product
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Product Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Gold Standard 100% Whey 2kg"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Brand</label>
                  <input
                    type="text"
                    placeholder="e.g. Optimum Nutrition"
                    value={form.brand}
                    onChange={(e) => setForm({ ...form, brand: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Category *</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white"
                  >
                    {CATEGORIES.filter((c) => c.key !== 'all').map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">SKU / Code</label>
                  <input
                    type="text"
                    placeholder="e.g. ON-WHEY-2KG"
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Barcode (EAN/UPC)</label>
                  <input
                    type="text"
                    placeholder="Scan or type barcode"
                    value={form.barcode}
                    onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Size / Weight</label>
                  <input
                    type="text"
                    placeholder="e.g. 2kg (4.4 lbs) or 60 tabs"
                    value={form.size}
                    onChange={(e) => setForm({ ...form, size: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Flavour / Variant</label>
                  <input
                    type="text"
                    placeholder="e.g. Double Rich Chocolate"
                    value={form.flavour}
                    onChange={(e) => setForm({ ...form, flavour: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Default Supplier</label>
                  <select
                    value={form.default_supplier_id}
                    onChange={(e) => setForm({ ...form, default_supplier_id: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white"
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Pricing & GST */}
              <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-3">
                <h4 className="font-semibold text-emerald-400 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4" /> Pricing & GST Configuration
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Cost Price (WAC) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="e.g. 5200"
                      value={form.cost_price}
                      onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Selling Price *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="e.g. 6499"
                      value={form.selling_price}
                      onChange={(e) => setForm({ ...form, selling_price: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">MRP</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 7499"
                      value={form.mrp}
                      onChange={(e) => setForm({ ...form, mrp: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">GST Tax %</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="18"
                      value={form.tax_percent}
                      onChange={(e) => setForm({ ...form, tax_percent: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Opening Stock & Batch */}
              <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-3">
                <h4 className="font-semibold text-blue-400 flex items-center gap-1.5">
                  <Layers className="w-4 h-4" /> Opening Stock & Batch Information
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Opening Stock (Qty)</label>
                    <input
                      type="number"
                      min="0"
                      value={form.opening_stock}
                      onChange={(e) => setForm({ ...form, opening_stock: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Low Stock Alert At</label>
                    <input
                      type="number"
                      min="1"
                      value={form.min_stock_alert}
                      onChange={(e) => setForm({ ...form, min_stock_alert: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Batch Number</label>
                    <input
                      type="text"
                      placeholder="e.g. BATCH-2026-01"
                      value={form.batch_number}
                      onChange={(e) => setForm({ ...form, batch_number: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Expiry Date</label>
                    <input
                      type="date"
                      value={form.expiry_date}
                      onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-lg cursor-pointer"
                >
                  Create Product & Record Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Adjust Stock */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-amber-400" />
                Adjust Stock / Write-Off
              </h3>
              <button onClick={() => setShowAdjustModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdjustStock} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Select Product *</label>
                <select
                  required
                  value={adjustForm.product_id}
                  onChange={(e) => setAdjustForm({ ...adjustForm, product_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white"
                >
                  <option value="">Choose Product</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Stock: {getStockQty(p)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Adjustment Type *</label>
                <select
                  value={adjustForm.adjustment_type}
                  onChange={(e) => setAdjustForm({ ...adjustForm, adjustment_type: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white"
                >
                  <option value="damaged">Damaged Goods (Write-off Loss)</option>
                  <option value="expired">Expired Goods (Write-off Loss)</option>
                  <option value="audit_count">Physical Audit Count Discrepancy</option>
                  <option value="supplier_return">Return to Supplier</option>
                  <option value="adjustment">General Adjustment</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Quantity Change (+ or -) *</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. -2 for loss write-off, or +5 for found stock"
                  value={adjustForm.quantity_change}
                  onChange={(e) => setAdjustForm({ ...adjustForm, quantity_change: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white"
                />
                <span className="text-[11px] text-slate-500">
                  Enter negative number (e.g. -1) to deduct damaged/expired goods. Never exceeds available stock.
                </span>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Reason / Notes *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cracked shaker lid during shipping unbox"
                  value={adjustForm.notes}
                  onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg cursor-pointer"
                >
                  Apply Stock Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Inter-Branch Stock Transfer */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-blue-400" />
                Inter-Branch Stock Transfer
              </h3>
              <button onClick={() => setShowTransferModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTransferStock} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">From Branch *</label>
                <select
                  required
                  value={transferForm.from_branch_id}
                  onChange={(e) => setTransferForm({ ...transferForm, from_branch_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">To Destination Branch *</label>
                <select
                  required
                  value={transferForm.to_branch_id}
                  onChange={(e) => setTransferForm({ ...transferForm, to_branch_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white"
                >
                  <option value="">Select Target Branch</option>
                  {branches
                    .filter((b) => b.id.toString() !== transferForm.from_branch_id.toString())
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Select Product *</label>
                <select
                  required
                  value={transferForm.product_id}
                  onChange={(e) => setTransferForm({ ...transferForm, product_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white"
                >
                  <option value="">Choose Product</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Quantity to Transfer *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={transferForm.quantity}
                  onChange={(e) => setTransferForm({ ...transferForm, quantity: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Replenishing secondary branch inventory"
                  value={transferForm.notes}
                  onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-slate-950 font-bold rounded-lg cursor-pointer"
                >
                  Transfer Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details & Movement History Drawer */}
      {showDetailsDrawer && selectedProduct && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex justify-end">
          <div className="bg-[#0f172a] border-l border-slate-800 w-full max-w-lg h-full overflow-y-auto p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">{selectedProduct.name}</h3>
                <span className="text-xs text-slate-400">{selectedProduct.brand || 'No Brand'} • {selectedProduct.category}</span>
              </div>
              <button onClick={() => setShowDetailsDrawer(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Product Key Metrics */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl">
                <span className="text-slate-500">Unit Cost (WAC)</span>
                <div className="text-base font-bold text-white">₹{parseFloat(selectedProduct.cost_price as string).toFixed(2)}</div>
              </div>
              <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl">
                <span className="text-slate-500">Selling Price</span>
                <div className="text-base font-bold text-emerald-400">₹{parseFloat(selectedProduct.selling_price as string).toFixed(2)}</div>
              </div>
            </div>

            {/* Batches Table */}
            <div>
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-emerald-400" /> Active Batches & Expiry
              </h4>
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 text-xs">
                {productDetails?.batches?.length > 0 ? (
                  <div className="space-y-2">
                    {productDetails.batches.map((b: any) => (
                      <div key={b.id} className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
                        <div>
                          <div className="font-semibold text-white">{b.batch_number}</div>
                          <div className="text-[11px] text-slate-500">Expiry: {b.expiry_date || 'No Expiry'}</div>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-emerald-400">{b.current_quantity} units</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-slate-500 text-center py-2">No active batches recorded.</div>
                )}
              </div>
            </div>

            {/* Permanent Movement Audit Ledger */}
            <div>
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <History className="w-4 h-4 text-blue-400" /> Permanent Movement Audit Trail
              </h4>
              <div className="space-y-2 text-xs">
                {productDetails?.movements?.length > 0 ? (
                  productDetails.movements.map((m: any) => (
                    <div key={m.id} className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white capitalize">{m.type.replace('_', ' ')}</span>
                          <span className="text-[10px] text-slate-500">{new Date(m.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="text-[11px] text-slate-400">{m.notes || '—'}</div>
                      </div>
                      <div className="text-right">
                        <div className={`font-bold ${m.quantity_change > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {m.quantity_change > 0 ? `+${m.quantity_change}` : m.quantity_change} units
                        </div>
                        <div className="text-[10px] text-slate-500">Stock after: {m.quantity_after}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-500 text-center py-4">No movements recorded yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
