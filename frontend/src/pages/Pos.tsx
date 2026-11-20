import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Barcode,
  CheckCircle2,
  CreditCard,
  Minus,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  ShoppingCart,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { formatCurrency, formatDateTime } from '../lib/formatters';

interface Product {
  id: number;
  name: string;
  brand: string | null;
  category: string;
  sku: string | null;
  barcode: string | null;
  flavour: string | null;
  size: string | null;
  selling_price: string | number;
  tax_percent: string | number;
  branch_stocks?: Array<{ quantity: number }>;
}

interface CartItem {
  product: Product;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  tax_percent: number;
  available_stock: number;
}

interface Member {
  id: number;
  member_code: string;
  first_name: string;
  last_name: string;
  phone: string;
  outstanding_balance: string | number;
}

interface PosOrder {
  id: number;
  order_number: string;
  order_date: string;
  customer_name: string;
  customer_phone: string | null;
  subtotal: string | number;
  discount_amount: string | number;
  tax_amount: string | number;
  total_amount: string | number;
  paid_amount: string | number;
  balance_due: string | number;
  payment_method: string;
  payment_status: string;
  status: string;
  cashier?: { name: string };
  member?: { id: number; member_code: string; first_name: string; last_name: string; phone: string };
  items?: Array<{
    id: number;
    product: { name: string; brand: string };
    quantity: number;
    unit_price: string | number;
    tax_percent: string | number;
    total_amount: string | number;
  }>;
}

const CATEGORIES = [
  { key: 'all', label: 'All Supplements' },
  { key: 'whey_protein', label: 'Whey' },
  { key: 'creatine', label: 'Creatine' },
  { key: 'pre_workout', label: 'Pre-Workout' },
  { key: 'protein_bars', label: 'Bars & Snacks' },
  { key: 'energy_drinks', label: 'Drinks' },
  { key: 'shakers', label: 'Shakers' },
  { key: 'gym_accessories', label: 'Accessories' },
];

export const Pos: React.FC = () => {
  const { t } = useTranslation();
  const { user, activeBranchId } = useAuth();
  const [activeTab, setActiveTab] = useState<'terminal' | 'orders'>('terminal');
  const [mobilePosView, setMobilePosView] = useState<'catalog' | 'cart'>('catalog');

  // Terminal state
  const [products, setProducts] = useState<Product[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [loading, setLoading] = useState(true);

  // Customer selection
  const [customerType, setCustomerType] = useState<'walk_in' | 'member'>('walk_in');
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [walkInName, setWalkInName] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');

  // Payment settings
  const [orderDiscount, setOrderDiscount] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'cash' | 'card' | 'bank_transfer'>('upi');
  const [paidAmount, setPaidAmount] = useState('');
  const [orderNotes, setOrderNotes] = useState('');

  // Orders history
  const [orders, setOrders] = useState<PosOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Receipt modal
  const [receiptOrder, setReceiptOrder] = useState<PosOrder | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Refund modal
  const [refundOrder, setRefundOrder] = useState<PosOrder | null>(null);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundForm, setRefundForm] = useState({
    amount: '',
    payment_mode: 'cash',
    reason: 'Customer returned sealed product',
    restock_items: true,
  });

  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState<string | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const fetchCatalog = async () => {
    try {
      setLoading(true);
      const [prodRes, memRes] = await Promise.all([
        api.get('/products', {
          params: { branch_id: activeBranchId, is_active: true, per_page: 100 },
        }),
        api.get('/members', {
          params: { branch_id: activeBranchId, per_page: 200 },
        }),
      ]);
      setProducts(prodRes.data.products.data || []);
      setMembers(memRes.data.members?.data || memRes.data.data || []);
    } catch (err) {
      console.error('Failed to load POS catalog', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    try {
      setOrdersLoading(true);
      const res = await api.get('/pos/orders', {
        params: { branch_id: activeBranchId, per_page: 30 },
      });
      setOrders(res.data.orders.data || []);
    } catch (err) {
      console.error('Failed to load POS orders', err);
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, [activeBranchId]);

  useEffect(() => {
    if (activeTab === 'orders') {
      fetchOrders();
    }
  }, [activeTab, activeBranchId]);

  // Barcode quick lookup & auto add to cart
  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;

    setCheckoutError(null);
    try {
      const res = await api.get(`/products/barcode/${encodeURIComponent(code)}`, {
        params: { branch_id: activeBranchId },
      });

      const foundProd = res.data.product;
      addToCart(foundProd);
      setBarcodeInput('');
    } catch (err: any) {
      setCheckoutError(`Barcode '${code}' not found or out of stock.`);
      setTimeout(() => setCheckoutError(null), 3000);
    }
  };

  const addToCart = (product: Product) => {
    setCheckoutError(null);
    const availableStock = product.branch_stocks?.[0]?.quantity ?? 0;

    if (availableStock <= 0) {
      setCheckoutError(`Cannot add "${product.name}": Out of stock at this branch.`);
      setTimeout(() => setCheckoutError(null), 3500);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= availableStock) {
          setCheckoutError(`Cannot add more "${product.name}": Available stock is only ${availableStock}.`);
          setTimeout(() => setCheckoutError(null), 3500);
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      } else {
        return [
          ...prev,
          {
            product,
            quantity: 1,
            unit_price: parseFloat(product.selling_price as string),
            discount_amount: 0,
            tax_percent: parseFloat(product.tax_percent as string || '0'),
            available_stock: availableStock,
          },
        ];
      }
    });
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            if (newQty > item.available_stock) {
              setCheckoutError(`Maximum available stock for "${item.product.name}" is ${item.available_stock}.`);
              setTimeout(() => setCheckoutError(null), 3500);
              return item;
            }
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const updateLineDiscount = (productId: number, discount: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, discount_amount: Math.max(0, discount) } : item
      )
    );
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  // Computations
  const subtotal = cart.reduce((acc, item) => acc + item.unit_price * item.quantity, 0);
  const itemsDiscount = cart.reduce((acc, item) => acc + item.discount_amount, 0);
  const additionalDiscount = parseFloat(orderDiscount) || 0;
  const totalDiscount = itemsDiscount + additionalDiscount;

  const totalTax = cart.reduce((acc, item) => {
    const lineSubtotal = Math.max(0, item.unit_price * item.quantity - item.discount_amount);
    return acc + lineSubtotal * (item.tax_percent / 100);
  }, 0);

  const grandTotal = Math.max(0, Math.round(subtotal - totalDiscount + totalTax));

  // Sync paid amount when grand total changes
  useEffect(() => {
    if (grandTotal > 0 && customerType === 'walk_in') {
      setPaidAmount(grandTotal.toString());
    }
  }, [grandTotal, customerType]);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutError(null);

    if (cart.length === 0) {
      setCheckoutError('Cart is empty. Add products to proceed.');
      return;
    }

    const paid = parseFloat(paidAmount) || 0;
    if (customerType === 'walk_in' && paid < grandTotal) {
      setCheckoutError('Walk-in customers must pay the full amount. Partial payments require a registered Member.');
      return;
    }

    try {
      const payload: any = {
        branch_id: activeBranchId,
        payment_method: paymentMethod,
        paid_amount: paid,
        order_discount: additionalDiscount,
        notes: orderNotes,
        items: cart.map((i) => ({
          product_id: i.product.id,
          quantity: i.quantity,
          unit_price: i.unit_price,
          discount_amount: i.discount_amount,
        })),
      };

      if (customerType === 'member') {
        if (!selectedMemberId) {
          setCheckoutError('Please select a registered gym member.');
          return;
        }
        payload.member_id = parseInt(selectedMemberId, 10);
      } else {
        payload.customer_name = walkInName.trim() || 'Walk-in Customer';
        payload.customer_phone = walkInPhone.trim() || null;
      }

      const res = await api.post('/pos/checkout', payload);
      const completedOrder = res.data.order;

      setReceiptOrder(completedOrder);
      setShowReceiptModal(true);
      setCheckoutSuccess(`Sale completed! Receipt #${completedOrder.order_number}`);

      // Reset cart and refresh stocks
      setCart([]);
      setOrderDiscount('0');
      setOrderNotes('');
      setWalkInName('');
      setWalkInPhone('');
      setSelectedMemberId('');
      fetchCatalog();

      setTimeout(() => setCheckoutSuccess(null), 4000);
    } catch (err: any) {
      setCheckoutError(err.response?.data?.message || err.response?.data?.errors?.items?.[0] || 'Checkout failed');
    }
  };

  const handleRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundOrder) return;

    try {
      await api.post(`/pos/orders/${refundOrder.id}/refund`, {
        amount: parseFloat(refundForm.amount),
        payment_mode: refundForm.payment_mode,
        reason: refundForm.reason,
        restock_items: refundForm.restock_items,
      });

      setShowRefundModal(false);
      setCheckoutSuccess(`Refund processed and items restocked for ${refundOrder.order_number}`);
      fetchOrders();
      fetchCatalog();
      setTimeout(() => setCheckoutSuccess(null), 4000);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Refund processing failed');
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    const matchesSearch =
      !search.trim() ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.brand && p.brand.toLowerCase().includes(search.toLowerCase())) ||
      (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      {/* Top Header & Tab Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <ShoppingCart className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">{t('pos.title')}</h1>
            <p className="text-xs text-slate-400">{t('pos.subtitle')}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('terminal')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'terminal'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {t('pos.cart')}
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'orders'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {t('common.actions')}
          </button>
        </div>
      </div>

      {checkoutSuccess && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{checkoutSuccess}</span>
        </div>
      )}

      {checkoutError && (
        <div className="p-3 bg-rose-950/60 border border-rose-500/40 rounded-xl text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{checkoutError}</span>
        </div>
      )}

      {activeTab === 'terminal' ? (
        <div className="space-y-4">
          {/* Mobile Terminal View Switcher (< lg) */}
          <div className="lg:hidden flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setMobilePosView('catalog')}
              className={`flex-1 py-2 font-bold rounded-lg transition-colors cursor-pointer text-center ${
                mobilePosView === 'catalog'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              1. Browse Products
            </button>
            <button
              onClick={() => setMobilePosView('cart')}
              className={`flex-1 py-2 font-bold rounded-lg transition-colors cursor-pointer text-center flex items-center justify-center gap-1.5 ${
                mobilePosView === 'cart'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>2. Cart ({cart.reduce((a, c) => a + c.quantity, 0)})</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Product Grid & Barcode Scanner (7 cols) */}
            <div className={`space-y-4 lg:col-span-7 ${mobilePosView === 'cart' ? 'hidden lg:block' : 'block'}`}>
              {/* Barcode Fast Gun Scanner */}
              <form onSubmit={handleBarcodeSubmit} className="relative">
                <Barcode className="w-5 h-5 text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  ref={barcodeInputRef}
                  type="text"
                  placeholder="Scan product barcode with scanner gun (or type barcode & press Enter)..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  className="w-full pl-10 pr-24 py-2.5 bg-slate-900/90 border-2 border-emerald-500/30 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-400 font-mono shadow-inner min-h-[44px]"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-lg cursor-pointer min-h-[32px]"
                >
                  Scan Add
                </button>
              </form>

            {/* Search and Category Filters */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter catalog by name, brand, or SKU..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-900/60 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/40"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.key}
                    onClick={() => setSelectedCategory(cat.key)}
                    className={`px-3 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                      selectedCategory === cat.key
                        ? 'bg-emerald-500 text-slate-950 font-bold'
                        : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[620px] overflow-y-auto pr-1">
              {loading ? (
                <div className="col-span-full p-12 text-center text-slate-500 text-xs">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-400" />
                  Loading supplement inventory...
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="col-span-full p-12 text-center text-slate-500 text-xs">
                  No active products found in this category.
                </div>
              ) : (
                filteredProducts.map((p) => {
                  const stock = p.branch_stocks?.[0]?.quantity ?? 0;
                  const isOutOfStock = stock <= 0;

                  return (
                    <button
                      key={p.id}
                      onClick={() => !isOutOfStock && addToCart(p)}
                      disabled={isOutOfStock}
                      className={`p-3 bg-slate-900/80 border text-left rounded-xl flex flex-col justify-between transition-all duration-150 cursor-pointer ${
                        isOutOfStock
                          ? 'border-slate-800/50 opacity-40 cursor-not-allowed'
                          : 'border-slate-800 hover:border-emerald-500/50 hover:bg-slate-800/60 active:scale-98 shadow-sm'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold truncate">
                            {p.brand || p.category}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              stock === 0
                                ? 'bg-rose-500/20 text-rose-400'
                                : stock <= 5
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-emerald-500/20 text-emerald-400'
                            }`}
                          >
                            {stock} in stock
                          </span>
                        </div>
                        <div className="text-xs font-bold text-white line-clamp-2">{p.name}</div>
                        {(p.flavour || p.size) && (
                          <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                            {p.flavour} {p.size ? `• ${p.size}` : ''}
                          </div>
                        )}
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-400">
                          {formatCurrency(parseFloat(p.selling_price as string))}
                        </span>
                        <span className="text-[10px] text-slate-500">+{p.tax_percent}% GST</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Checkout Cart & Order Engine (5 cols) */}
          <div className={`lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4 ${mobilePosView === 'catalog' ? 'hidden lg:block' : 'block'}`}>
            <button
              type="button"
              onClick={() => setMobilePosView('catalog')}
              className="lg:hidden w-full text-left text-xs text-emerald-400 font-bold flex items-center gap-1.5 pb-2.5 border-b border-slate-800 cursor-pointer"
            >
              ← Back to Product Catalog
            </button>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-emerald-400" />
                Current Checkout Cart ({cart.reduce((a, c) => a + c.quantity, 0)})
              </h3>
              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="text-slate-500 hover:text-rose-400 text-xs flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear Cart
                </button>
              )}
            </div>

            {/* Cart Line Items */}
            <div className="max-h-[260px] overflow-y-auto space-y-2 pr-1">
              {cart.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  Cart is empty. Tap products or scan barcode to add.
                </div>
              ) : (
                cart.map((item) => {
                  const lineTotal = Math.round(
                    (item.unit_price * item.quantity - item.discount_amount) * (1 + item.tax_percent / 100)
                  );

                  return (
                    <div
                      key={item.product.id}
                      className="p-2.5 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-2 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold text-white leading-tight">{item.product.name}</div>
                          <div className="text-[10px] text-slate-400">
                            ₹{item.unit_price} each • {item.tax_percent}% GST
                          </div>
                        </div>
                        <button
                          onClick={() => removeFromCart(item.product.id)}
                          className="text-slate-500 hover:text-rose-400 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        {/* Stepper */}
                        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product.id, -1)}
                            className="p-1 hover:bg-slate-800 text-slate-300 rounded cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-6 text-center font-bold text-white text-xs">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product.id, 1)}
                            className="p-1 hover:bg-slate-800 text-slate-300 rounded cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Line Discount */}
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-500">Disc:</span>
                          <input
                            type="number"
                            min="0"
                            placeholder="₹0"
                            value={item.discount_amount || ''}
                            onChange={(e) => updateLineDiscount(item.product.id, parseFloat(e.target.value) || 0)}
                            className="w-14 px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded text-center text-white text-[11px]"
                          />
                        </div>

                        {/* Line Total */}
                        <span className="font-bold text-white">₹{lineTotal}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Customer Selector */}
            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-emerald-400" /> Customer Type
                </span>
                <div className="flex bg-slate-900 rounded-lg p-0.5 border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setCustomerType('walk_in')}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer transition-colors ${
                      customerType === 'walk_in' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'
                    }`}
                  >
                    Walk-in
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomerType('member')}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer transition-colors ${
                      customerType === 'member' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'
                    }`}
                  >
                    Gym Member
                  </button>
                </div>
              </div>

              {customerType === 'walk_in' ? (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Customer Name (Optional)"
                    value={walkInName}
                    onChange={(e) => setWalkInName(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Phone Number (Optional)"
                    value={walkInPhone}
                    onChange={(e) => setWalkInPhone(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white text-xs"
                  />
                </div>
              ) : (
                <div className="pt-1">
                  <select
                    value={selectedMemberId}
                    onChange={(e) => setSelectedMemberId(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white text-xs"
                  >
                    <option value="">Select Member (Search by name or code)</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.member_code} - {m.first_name} {m.last_name} ({m.phone})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Calculations Breakdown */}
            <div className="space-y-1.5 text-xs text-slate-300 border-t border-slate-800 pt-3">
              <div className="flex justify-between">
                <span className="text-slate-400">Subtotal</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Order Level Discount</span>
                <div className="flex items-center gap-1">
                  <span>-₹</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={orderDiscount}
                    onChange={(e) => setOrderDiscount(e.target.value)}
                    className="w-16 px-1.5 py-0.5 bg-slate-950 border border-slate-800 rounded text-right text-amber-400 text-xs"
                  />
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Estimated GST Tax</span>
                <span>+₹{totalTax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-white border-t border-slate-800 pt-2">
                <span>{t('pos.total_payable')}</span>
                <span className="text-emerald-400 text-base">{formatCurrency(grandTotal)}</span>
              </div>
            </div>

            {/* Payment Mode & Amount Paid */}
            <form onSubmit={handleCheckout} className="space-y-3 pt-2 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Payment Mode</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['upi', 'cash', 'card', 'bank_transfer'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPaymentMethod(mode)}
                      className={`py-1.5 rounded-lg font-semibold uppercase text-[10px] border transition-colors cursor-pointer ${
                        paymentMethod === mode
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {mode.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-400 font-semibold">Amount Paid (₹) *</label>
                  <button
                    type="button"
                    onClick={() => setPaidAmount(grandTotal.toString())}
                    className="text-[10px] text-emerald-400 hover:underline cursor-pointer"
                  >
                    Pay Full Amount
                  </button>
                </div>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 5000"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-bold text-sm"
                />
                {customerType === 'member' && parseFloat(paidAmount) < grandTotal && (
                  <div className="text-[11px] text-amber-400 mt-1">
                    Balance Due: ₹{(grandTotal - (parseFloat(paidAmount) || 0)).toFixed(2)} will be debited to Member's account.
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={cart.length === 0}
                className="w-full py-3 bg-[#D92332] hover:bg-[#B91C2B] dark:bg-[#F02D3A] dark:hover:bg-[#FF4652] disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold text-sm rounded-xl shadow-lg shadow-red-600/30 transition-all cursor-pointer flex items-center justify-center gap-2 min-h-[44px]"
              >
                <CheckCircle2 className="w-5 h-5" />
                Complete Sale & Print Receipt
              </button>
            </form>
          </div>
        </div>

        {/* Floating Mobile Cart Pill when on catalog view */}
        {cart.length > 0 && mobilePosView === 'catalog' && (
          <div className="lg:hidden fixed bottom-24 left-4 right-4 z-30">
            <button
              onClick={() => setMobilePosView('cart')}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3 px-4 rounded-2xl shadow-2xl flex items-center justify-between text-xs cursor-pointer border border-emerald-400 min-h-[48px]"
            >
              <span className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" />
                <span>{cart.reduce((a, c) => a + c.quantity, 0)} in Cart</span>
              </span>
              <span className="bg-slate-950 text-emerald-400 px-3 py-1 rounded-xl text-xs font-bold">
                Checkout →
              </span>
            </button>
          </div>
        )}
      </div>
      ) : (
        /* Orders & Refunds View */
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Recent POS Sales Ledger</h3>
            <button
              onClick={fetchOrders}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer min-h-[36px]"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          {ordersLoading ? (
            <div className="p-8 text-center text-slate-500 text-xs">Loading orders...</div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">No POS orders recorded yet.</div>
          ) : (
            <>
              {/* Mobile Cards View (< md) */}
              <div className="md:hidden divide-y divide-slate-800/70">
                {orders.map((ord) => (
                  <div key={ord.id} className="p-4 hover:bg-slate-800/30 transition-colors space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-xs text-emerald-400">{ord.order_number}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          ord.status === 'refunded'
                            ? 'bg-rose-500/20 text-rose-300'
                            : 'bg-emerald-500/20 text-emerald-300'
                        }`}
                      >
                        {ord.status}
                      </span>
                    </div>

                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold text-white text-xs">{ord.customer_name}</div>
                        {ord.member && (
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">#{ord.member.member_code}</div>
                        )}
                        <div className="text-[10px] text-slate-500 font-mono mt-1">{ord.order_date} • {ord.payment_method.toUpperCase()}</div>
                      </div>

                      <div className="text-right">
                        <div className="font-bold text-white text-sm font-mono">₹{parseFloat(ord.total_amount as string).toFixed(2)}</div>
                        <div className="text-[10px] text-emerald-400 font-mono">Paid: ₹{parseFloat(ord.paid_amount as string).toFixed(2)}</div>
                        {parseFloat(ord.balance_due as string) > 0 && (
                          <div className="text-[10px] text-amber-400 font-mono">Due: ₹{parseFloat(ord.balance_due as string).toFixed(2)}</div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800/60">
                      <button
                        onClick={() => {
                          setReceiptOrder(ord);
                          setShowReceiptModal(true);
                        }}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs cursor-pointer min-h-[36px]"
                      >
                        Receipt
                      </button>
                      {ord.status !== 'refunded' && parseFloat(ord.paid_amount as string) > 0 && (
                        <button
                          onClick={() => {
                            setRefundOrder(ord);
                            setRefundForm({
                              amount: ord.paid_amount.toString(),
                              payment_mode: ord.payment_method === 'split' ? 'cash' : ord.payment_method,
                              reason: 'Customer returned sealed product',
                              restock_items: true,
                            });
                            setShowRefundModal(true);
                          }}
                          className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-lg text-xs cursor-pointer min-h-[36px]"
                        >
                          Refund
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View (>= md) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                    <tr>
                      <th className="p-3">{t('pos.col_order_no', 'Order #')}</th>
                      <th className="p-3">{t('common.date', 'Date')}</th>
                      <th className="p-3">{t('pos.col_customer', 'Customer / Member')}</th>
                      <th className="p-3">{t('common.payment_mode', 'Payment Mode')}</th>
                      <th className="p-3 text-right">{t('pos.col_total', 'Total')}</th>
                      <th className="p-3 text-right">{t('pos.col_paid', 'Paid')}</th>
                      <th className="p-3 text-right">{t('pos.col_balance_due', 'Balance Due')}</th>
                      <th className="p-3 text-center">{t('common.status', 'Status')}</th>
                      <th className="p-3 text-center">{t('common.actions', 'Actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {orders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-slate-800/30">
                        <td className="p-3 font-mono font-bold text-emerald-400">{ord.order_number}</td>
                        <td className="p-3 text-slate-400">{ord.order_date}</td>
                        <td className="p-3">
                          <div className="font-semibold text-white">{ord.customer_name}</div>
                          {ord.member && (
                            <div className="text-[10px] text-slate-500">Member #{ord.member.member_code}</div>
                          )}
                        </td>
                        <td className="p-3 uppercase font-medium text-slate-400">{ord.payment_method}</td>
                        <td className="p-3 text-right font-bold text-white">₹{parseFloat(ord.total_amount as string).toFixed(2)}</td>
                        <td className="p-3 text-right text-emerald-400">₹{parseFloat(ord.paid_amount as string).toFixed(2)}</td>
                        <td className="p-3 text-right font-medium text-amber-400">
                          ₹{parseFloat(ord.balance_due as string).toFixed(2)}
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              ord.status === 'refunded'
                                ? 'bg-rose-500/20 text-rose-300'
                                : 'bg-emerald-500/20 text-emerald-300'
                            }`}
                          >
                            {ord.status}
                          </span>
                        </td>
                        <td className="p-3 text-center space-x-2">
                          <button
                            onClick={() => {
                              setReceiptOrder(ord);
                              setShowReceiptModal(true);
                            }}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] cursor-pointer"
                          >
                            Receipt
                          </button>
                          {ord.status !== 'refunded' && parseFloat(ord.paid_amount as string) > 0 && (
                            <button
                              onClick={() => {
                                setRefundOrder(ord);
                                setRefundForm({
                                  amount: ord.paid_amount.toString(),
                                  payment_mode: ord.payment_method === 'split' ? 'cash' : ord.payment_method,
                                  reason: 'Customer returned sealed product',
                                  restock_items: true,
                                });
                                setShowRefundModal(true);
                              }}
                              className="px-2 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded text-[11px] cursor-pointer"
                            >
                              Refund
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Printable Receipt Modal */}
      {showReceiptModal && receiptOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="font-bold uppercase tracking-wider text-slate-700">Gym Supplement Receipt</span>
              <button onClick={() => setShowReceiptModal(false)} className="text-slate-500 hover:text-black cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Receipt Body */}
            <div id="receipt-printable-area" className="space-y-3">
              <div className="text-center">
                <div className="font-extrabold text-base uppercase">{user?.gym?.name || 'GYM BUSINESS OS'}</div>
                <div className="text-[11px] text-slate-600">Official POS Tax Invoice</div>
                <div className="text-[11px] text-slate-500">Order: {receiptOrder.order_number}</div>
                <div className="text-[11px] text-slate-500">Date: {receiptOrder.order_date}</div>
              </div>

              <div className="border-t border-b border-dashed py-2 text-[11px]">
                <div>Customer: <span className="font-bold">{receiptOrder.customer_name}</span></div>
                {receiptOrder.customer_phone && <div>Phone: {receiptOrder.customer_phone}</div>}
                {receiptOrder.member && <div>Member Code: {receiptOrder.member.member_code}</div>}
              </div>

              {/* Items Table */}
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="border-b font-bold">
                    <th className="py-1">Item</th>
                    <th className="py-1 text-center">Qty</th>
                    <th className="py-1 text-right">Rate</th>
                    <th className="py-1 text-right">Amt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {receiptOrder.items?.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-1 font-sans">{item.product.name}</td>
                      <td className="py-1 text-center">{item.quantity}</td>
                      <td className="py-1 text-right">₹{item.unit_price}</td>
                      <td className="py-1 text-right font-bold">₹{item.total_amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div className="border-t border-dashed pt-2 space-y-1 text-right text-[11px]">
                <div>Subtotal: ₹{receiptOrder.subtotal}</div>
                {parseFloat(receiptOrder.discount_amount as string) > 0 && (
                  <div>Discount: -₹{receiptOrder.discount_amount}</div>
                )}
                <div>GST Tax: +₹{receiptOrder.tax_amount}</div>
                <div className="font-extrabold text-sm pt-1 border-t">Total: ₹{receiptOrder.total_amount}</div>
                <div className="font-bold text-emerald-700">Paid ({receiptOrder.payment_method}): ₹{receiptOrder.paid_amount}</div>
                {parseFloat(receiptOrder.balance_due as string) > 0 && (
                  <div className="font-bold text-rose-700">Balance Due: ₹{receiptOrder.balance_due}</div>
                )}
              </div>

              <div className="text-center text-[10px] text-slate-500 pt-2 border-t">
                Thank you for your purchase! Stay fit & healthy.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" /> Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {showRefundModal && refundOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-rose-400" />
                Process Order Refund
              </h3>
              <button onClick={() => setShowRefundModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRefundSubmit} className="space-y-4 text-xs">
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                <div className="text-slate-400">Order: <span className="text-white font-mono">{refundOrder.order_number}</span></div>
                <div className="text-slate-400">Customer: <span className="text-white">{refundOrder.customer_name}</span></div>
                <div className="text-slate-400">Paid Amount: <span className="text-emerald-400 font-bold">₹{refundOrder.paid_amount}</span></div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Refund Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  max={refundOrder.paid_amount}
                  value={refundForm.amount}
                  onChange={(e) => setRefundForm({ ...refundForm, amount: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Refund Mode *</label>
                <select
                  value={refundForm.payment_mode}
                  onChange={(e) => setRefundForm({ ...refundForm, payment_mode: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white"
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI / Instant Online</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="card">Card</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Reason for Refund *</label>
                <input
                  type="text"
                  required
                  value={refundForm.reason}
                  onChange={(e) => setRefundForm({ ...refundForm, reason: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="restock"
                  checked={refundForm.restock_items}
                  onChange={(e) => setRefundForm({ ...refundForm, restock_items: e.target.checked })}
                  className="rounded text-emerald-500 focus:ring-0"
                />
                <label htmlFor="restock" className="text-slate-300 font-medium cursor-pointer">
                  Restock returned items back to branch inventory
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRefundModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-lg cursor-pointer"
                >
                  Process Refund
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Pos;
