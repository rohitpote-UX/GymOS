import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  Building,
  CheckCircle2,
  DollarSign,
  FileText,
  History,
  Layers,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface Supplier {
  id: number;
  name: string;
  company_name: string | null;
  contact_person: string | null;
  phone: string;
  email: string | null;
  gstin: string | null;
  city: string | null;
  total_purchased: string | number;
  total_paid: string | number;
  outstanding_balance: string | number;
  is_active: boolean;
}

interface PurchaseInvoice {
  id: number;
  invoice_number: string;
  invoice_date: string;
  total_amount: string | number;
  paid_amount: string | number;
  status: string;
  payment_status: string;
  supplier: { id: number; name: string; phone: string };
  branch: { id: number; name: string };
  items?: Array<{
    id: number;
    product: { name: string; brand: string };
    quantity: number;
    unit_cost: string | number;
    total_amount: string | number;
  }>;
}

interface Product {
  id: number;
  name: string;
  cost_price: string | number;
  tax_percent: string | number;
}

export const Purchases: React.FC = () => {
  const { t } = useTranslation();
  const { user, activeBranchId } = useAuth();
  const branches = user?.branches || [];
  const [activeTab, setActiveTab] = useState<'invoices' | 'suppliers'>('invoices');

  // Suppliers state
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [suppliersSummary, setSuppliersSummary] = useState<any>(null);

  // Invoices state
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoicesSummary, setInvoicesSummary] = useState<any>(null);

  // Catalog products for invoice items
  const [products, setProducts] = useState<Product[]>([]);

  // Modals
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showLedgerDrawer, setShowLedgerDrawer] = useState(false);
  const [showNewInvoiceModal, setShowNewInvoiceModal] = useState(false);

  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierLedger, setSupplierLedger] = useState<any[]>([]);

  // Forms
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    company_name: '',
    contact_person: '',
    phone: '',
    email: '',
    gstin: '',
    city: '',
    address: '',
    bank_details: '',
  });

  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    payment_mode: 'bank_transfer',
    reference_id: '',
    notes: '',
  });

  const [invoiceForm, setInvoiceForm] = useState<{
    supplier_id: string;
    branch_id: string;
    invoice_number: string;
    invoice_date: string;
    paid_amount: string;
    payment_mode: string;
    notes: string;
    items: Array<{
      product_id: string;
      quantity: string;
      unit_cost: string;
      tax_percent: string;
      batch_number: string;
      expiry_date: string;
    }>;
  }>({
    supplier_id: '',
    branch_id: activeBranchId ? activeBranchId.toString() : '',
    invoice_number: '',
    invoice_date: new Date().toISOString().split('T')[0],
    paid_amount: '0',
    payment_mode: 'bank_transfer',
    notes: '',
    items: [
      {
        product_id: '',
        quantity: '10',
        unit_cost: '',
        tax_percent: '18',
        batch_number: '',
        expiry_date: '',
      },
    ],
  });

  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchSuppliers = async () => {
    try {
      setSuppliersLoading(true);
      const res = await api.get('/suppliers');
      setSuppliers(res.data.suppliers.data || []);
      setSuppliersSummary(res.data.summary || null);
    } catch (err) {
      console.error('Failed to load suppliers', err);
    } finally {
      setSuppliersLoading(false);
    }
  };

  const fetchInvoices = async () => {
    try {
      setInvoicesLoading(true);
      const res = await api.get('/purchase-invoices', {
        params: { branch_id: activeBranchId },
      });
      setInvoices(res.data.invoices.data || []);
      setInvoicesSummary(res.data.summary || null);
    } catch (err) {
      console.error('Failed to load purchase invoices', err);
    } finally {
      setInvoicesLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await api.get('/products', { params: { per_page: 150 } });
      setProducts(res.data.products.data || []);
    } catch (err) {
      console.error('Failed to load products', err);
    }
  };

  useEffect(() => {
    fetchSuppliers();
    fetchInvoices();
    fetchProducts();
  }, [activeBranchId]);

  const openSupplierLedger = async (sup: Supplier) => {
    setSelectedSupplier(sup);
    setShowLedgerDrawer(true);
    try {
      const res = await api.get(`/suppliers/${sup.id}/ledger`);
      setSupplierLedger(res.data.ledgers.data || []);
    } catch (err) {
      console.error('Failed to load ledger', err);
    }
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      await api.post('/suppliers', supplierForm);
      setShowAddSupplierModal(false);
      setActionSuccess('Supplier registered successfully!');
      fetchSuppliers();
      setSupplierForm({
        name: '',
        company_name: '',
        contact_person: '',
        phone: '',
        email: '',
        gstin: '',
        city: '',
        address: '',
        bank_details: '',
      });
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setActionError(err.response?.data?.message || 'Failed to create supplier');
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier) return;
    setActionError(null);
    try {
      await api.post(`/suppliers/${selectedSupplier.id}/payments`, {
        amount: parseFloat(paymentForm.amount),
        payment_mode: paymentForm.payment_mode,
        reference_id: paymentForm.reference_id,
        notes: paymentForm.notes,
        branch_id: activeBranchId,
      });

      setShowPaymentModal(false);
      setActionSuccess(`Payment recorded for ${selectedSupplier.name}! Outstanding balance updated.`);
      fetchSuppliers();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setActionError(err.response?.data?.message || 'Failed to record payment');
    }
  };

  // Invoice Items dynamic rows
  const addInvoiceItem = () => {
    setInvoiceForm({
      ...invoiceForm,
      items: [
        ...invoiceForm.items,
        {
          product_id: '',
          quantity: '10',
          unit_cost: '',
          tax_percent: '18',
          batch_number: '',
          expiry_date: '',
        },
      ],
    });
  };

  const removeInvoiceItem = (index: number) => {
    setInvoiceForm({
      ...invoiceForm,
      items: invoiceForm.items.filter((_, i) => i !== index),
    });
  };

  const updateInvoiceItem = (index: number, field: string, value: string) => {
    const updated = [...invoiceForm.items];
    (updated[index] as any)[field] = value;

    // If product changed, auto-fill unit_cost with current product cost price
    if (field === 'product_id') {
      const prod = products.find((p) => p.id.toString() === value);
      if (prod) {
        updated[index].unit_cost = prod.cost_price.toString();
        updated[index].tax_percent = prod.tax_percent.toString();
      }
    }

    setInvoiceForm({ ...invoiceForm, items: updated });
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);

    try {
      const payload = {
        supplier_id: parseInt(invoiceForm.supplier_id, 10),
        branch_id: parseInt(invoiceForm.branch_id || (activeBranchId as any), 10),
        invoice_number: invoiceForm.invoice_number.trim() || null,
        invoice_date: invoiceForm.invoice_date,
        paid_amount: parseFloat(invoiceForm.paid_amount) || 0,
        payment_mode: invoiceForm.payment_mode,
        notes: invoiceForm.notes,
        items: invoiceForm.items.map((i) => ({
          product_id: parseInt(i.product_id, 10),
          quantity: parseInt(i.quantity, 10),
          unit_cost: parseFloat(i.unit_cost),
          tax_percent: parseFloat(i.tax_percent) || 0,
          batch_number: i.batch_number || null,
          expiry_date: i.expiry_date || null,
        })),
      };

      await api.post('/purchase-invoices', payload);
      setShowNewInvoiceModal(false);
      setActionSuccess('Purchase invoice recorded! Stock added and Weighted Average Cost updated.');
      fetchInvoices();
      fetchSuppliers();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setActionError(err.response?.data?.message || 'Failed to record purchase invoice');
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Truck className="w-7 h-7 text-emerald-400" />
            {t('inventory.purchases', 'Purchases & Supplier Ledger')}
          </h1>
          <p className="text-sm text-slate-400">
            {t('inventory.subtitle', 'Goods inward, supplier accounting, and automated Weighted Average Costing (WAC).')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddSupplierModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 cursor-pointer"
          >
            <Building className="w-4 h-4 text-emerald-400" />
            {t('common.add', 'New')} {t('inventory.supplier', 'Supplier')}
          </button>

          <button
            onClick={() => setShowNewInvoiceModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-bold rounded-lg shadow-lg shadow-emerald-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {t('inventory.add_stock', 'Record Stock Purchase')}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('invoices')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'invoices' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
          }`}
        >
          Purchase Invoices & Goods Inward
        </button>
        <button
          onClick={() => setActiveTab('suppliers')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'suppliers' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
          }`}
        >
          Suppliers Directory & Dues
        </button>
      </div>

      {actionSuccess && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="p-3 bg-rose-950/60 border border-rose-500/40 rounded-xl text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Invoices View */}
      {activeTab === 'invoices' ? (
        <div className="space-y-4">
          {invoicesSummary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
                <span className="text-xs text-slate-400">Total Purchase Orders</span>
                <div className="text-xl font-bold text-white mt-1">{invoicesSummary.total_invoices}</div>
              </div>
              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
                <span className="text-xs text-slate-400">Total Purchases Value</span>
                <div className="text-xl font-bold text-white mt-1">₹{invoicesSummary.total_amount.toLocaleString('en-IN')}</div>
              </div>
              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
                <span className="text-xs text-slate-400">Total Paid to Suppliers</span>
                <div className="text-xl font-bold text-emerald-400 mt-1">₹{invoicesSummary.total_paid.toLocaleString('en-IN')}</div>
              </div>
              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
                <span className="text-xs text-slate-400">Pending Payables</span>
                <div className="text-xl font-bold text-amber-400 mt-1">₹{invoicesSummary.total_unpaid.toLocaleString('en-IN')}</div>
              </div>
            </div>
          )}

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-3">Invoice #</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Supplier</th>
                    <th className="p-3">Receiving Branch</th>
                    <th className="p-3 text-right">Total (₹)</th>
                    <th className="p-3 text-right">Paid (₹)</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Payment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {invoicesLoading ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500">
                        Loading purchase invoices...
                      </td>
                    </tr>
                  ) : invoices.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500">
                        No purchase invoices recorded yet.
                      </td>
                    </tr>
                  ) : (
                    invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-800/30">
                        <td className="p-3 font-mono font-bold text-emerald-400">{inv.invoice_number}</td>
                        <td className="p-3 text-slate-400">{inv.invoice_date}</td>
                        <td className="p-3 font-semibold text-white">{inv.supplier?.name}</td>
                        <td className="p-3 text-slate-400">{inv.branch?.name}</td>
                        <td className="p-3 text-right font-bold text-white">₹{parseFloat(inv.total_amount as string).toFixed(2)}</td>
                        <td className="p-3 text-right text-emerald-400">₹{parseFloat(inv.paid_amount as string).toFixed(2)}</td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300">
                            {inv.status}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              inv.payment_status === 'paid'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-amber-500/20 text-amber-300'
                            }`}
                          >
                            {inv.payment_status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Suppliers View */
        <div className="space-y-4">
          {suppliersSummary && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
                <span className="text-xs text-slate-400">Registered Suppliers</span>
                <div className="text-xl font-bold text-white mt-1">{suppliersSummary.total_suppliers}</div>
              </div>
              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
                <span className="text-xs text-slate-400">Total Purchased</span>
                <div className="text-xl font-bold text-white mt-1">₹{suppliersSummary.total_purchased.toLocaleString('en-IN')}</div>
              </div>
              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
                <span className="text-xs text-slate-400">Outstanding Payables</span>
                <div className="text-xl font-bold text-rose-400 mt-1">₹{suppliersSummary.total_outstanding.toLocaleString('en-IN')}</div>
              </div>
            </div>
          )}

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-3">Supplier Name</th>
                    <th className="p-3">Contact</th>
                    <th className="p-3">GSTIN</th>
                    <th className="p-3 text-right">Total Purchased</th>
                    <th className="p-3 text-right">Total Paid</th>
                    <th className="p-3 text-right">Balance Due</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {suppliersLoading ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        Loading suppliers...
                      </td>
                    </tr>
                  ) : suppliers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        No suppliers registered yet.
                      </td>
                    </tr>
                  ) : (
                    suppliers.map((sup) => (
                      <tr key={sup.id} className="hover:bg-slate-800/30">
                        <td className="p-3">
                          <div className="font-semibold text-white">{sup.name}</div>
                          {sup.company_name && <div className="text-[11px] text-slate-500">{sup.company_name}</div>}
                        </td>
                        <td className="p-3">
                          <div>{sup.contact_person || '—'}</div>
                          <div className="text-[11px] text-slate-500">{sup.phone}</div>
                        </td>
                        <td className="p-3 font-mono text-[11px] text-slate-400">{sup.gstin || '—'}</td>
                        <td className="p-3 text-right font-medium text-white">
                          ₹{parseFloat(sup.total_purchased as string).toFixed(2)}
                        </td>
                        <td className="p-3 text-right text-emerald-400">
                          ₹{parseFloat(sup.total_paid as string).toFixed(2)}
                        </td>
                        <td className="p-3 text-right font-bold text-amber-400">
                          ₹{parseFloat(sup.outstanding_balance as string).toFixed(2)}
                        </td>
                        <td className="p-3 text-center space-x-2">
                          <button
                            onClick={() => {
                              setSelectedSupplier(sup);
                              setPaymentForm({
                                amount: sup.outstanding_balance.toString(),
                                payment_mode: 'bank_transfer',
                                reference_id: '',
                                notes: '',
                              });
                              setShowPaymentModal(true);
                            }}
                            className="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded text-[11px] cursor-pointer"
                          >
                            Pay
                          </button>
                          <button
                            onClick={() => openSupplierLedger(sup)}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] cursor-pointer"
                          >
                            Ledger
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Register Supplier */}
      {showAddSupplierModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Building className="w-5 h-5 text-emerald-400" />
                Register New Supplier
              </h3>
              <button onClick={() => setShowAddSupplierModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSupplier} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Supplier / Trade Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Optimum Nutrition India Dist"
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Company Legal Entity</label>
                <input
                  type="text"
                  placeholder="e.g. Glanbia Performance Nutrition Pvt Ltd"
                  value={supplierForm.company_name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, company_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Phone *</label>
                  <input
                    type="text"
                    required
                    placeholder="9820011223"
                    value={supplierForm.phone}
                    onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Contact Person</label>
                  <input
                    type="text"
                    placeholder="Rajesh Shah"
                    value={supplierForm.contact_person}
                    onChange={(e) => setSupplierForm({ ...supplierForm, contact_person: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">GSTIN</label>
                  <input
                    type="text"
                    placeholder="27AABCO1234F1Z5"
                    value={supplierForm.gstin}
                    onChange={(e) => setSupplierForm({ ...supplierForm, gstin: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">City</label>
                  <input
                    type="text"
                    placeholder="Mumbai"
                    value={supplierForm.city}
                    onChange={(e) => setSupplierForm({ ...supplierForm, city: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Bank Account & IFSC</label>
                <input
                  type="text"
                  placeholder="HDFC Bank - A/C 5020001234, IFSC: HDFC0000045"
                  value={supplierForm.bank_details}
                  onChange={(e) => setSupplierForm({ ...supplierForm, bank_details: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddSupplierModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-lg cursor-pointer"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Record Supplier Payment */}
      {showPaymentModal && selectedSupplier && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                Record Supplier Payment
              </h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                <div className="text-slate-400">Supplier: <span className="text-white font-bold">{selectedSupplier.name}</span></div>
                <div className="text-slate-400">Current Outstanding: <span className="text-amber-400 font-bold">₹{selectedSupplier.outstanding_balance}</span></div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Payment Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 25000"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Payment Mode *</label>
                <select
                  value={paymentForm.payment_mode}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_mode: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white"
                >
                  <option value="bank_transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                  <option value="upi">UPI</option>
                  <option value="cheque">Cheque</option>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Transaction Ref / Cheque #</label>
                <input
                  type="text"
                  placeholder="e.g. UTR-99882233"
                  value={paymentForm.reference_id}
                  onChange={(e) => setPaymentForm({ ...paymentForm, reference_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-lg cursor-pointer"
                >
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Record New Stock Purchase Invoice */}
      {showNewInvoiceModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Truck className="w-5 h-5 text-emerald-400" />
                Record Stock Purchase (Goods Inward & WAC Update)
              </h3>
              <button onClick={() => setShowNewInvoiceModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateInvoice} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Supplier *</label>
                  <select
                    required
                    value={invoiceForm.supplier_id}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, supplier_id: e.target.value })}
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

                <div>
                  <label className="block text-slate-400 mb-1">Receiving Branch *</label>
                  <select
                    required
                    value={invoiceForm.branch_id}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, branch_id: e.target.value })}
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
                  <label className="block text-slate-400 mb-1">Invoice Number (Optional)</label>
                  <input
                    type="text"
                    placeholder="Auto-generated if empty"
                    value={invoiceForm.invoice_number}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, invoice_number: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white"
                  />
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-300">Purchase Line Items</h4>
                  <button
                    type="button"
                    onClick={addInvoiceItem}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Item
                  </button>
                </div>

                <div className="space-y-2">
                  {invoiceForm.items.map((item, idx) => (
                    <div key={idx} className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                        <div className="md:col-span-2">
                          <label className="block text-slate-400 mb-0.5">Product *</label>
                          <select
                            required
                            value={item.product_id}
                            onChange={(e) => updateInvoiceItem(idx, 'product_id', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs"
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
                          <label className="block text-slate-400 mb-0.5">Quantity *</label>
                          <input
                            type="number"
                            min="1"
                            required
                            value={item.quantity}
                            onChange={(e) => updateInvoiceItem(idx, 'quantity', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-400 mb-0.5">Unit Purchase Cost (₹) *</label>
                          <input
                            type="number"
                            step="0.01"
                            required
                            value={item.unit_cost}
                            onChange={(e) => updateInvoiceItem(idx, 'unit_cost', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1 border-t border-slate-800/60">
                        <div>
                          <label className="block text-slate-400 mb-0.5">Batch Number</label>
                          <input
                            type="text"
                            placeholder="e.g. BATCH-2026-X"
                            value={item.batch_number}
                            onChange={(e) => updateInvoiceItem(idx, 'batch_number', e.target.value)}
                            className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-white text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-0.5">Expiry Date</label>
                          <input
                            type="date"
                            value={item.expiry_date}
                            onChange={(e) => updateInvoiceItem(idx, 'expiry_date', e.target.value)}
                            className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-white text-xs"
                          />
                        </div>
                        <div className="flex items-end justify-end">
                          {invoiceForm.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeInvoiceItem(idx)}
                              className="text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer py-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Remove Row
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Upfront Payment */}
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Upfront Payment to Supplier (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={invoiceForm.paid_amount}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, paid_amount: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Payment Mode</label>
                  <select
                    value={invoiceForm.payment_mode}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, payment_mode: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  >
                    <option value="bank_transfer">Bank Transfer (NEFT/RTGS)</option>
                    <option value="upi">UPI</option>
                    <option value="cheque">Cheque</option>
                    <option value="cash">Cash</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewInvoiceModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-lg cursor-pointer"
                >
                  Confirm Purchase & Update WAC Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Ledger Drawer */}
      {showLedgerDrawer && selectedSupplier && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex justify-end">
          <div className="bg-[#0f172a] border-l border-slate-800 w-full max-w-lg h-full overflow-y-auto p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">{selectedSupplier.name}</h3>
                <span className="text-slate-400">Ledger Statement & Running Balances</span>
              </div>
              <button onClick={() => setShowLedgerDrawer(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-slate-500">Current Outstanding Balance</span>
                <div className="text-lg font-bold text-amber-400">₹{selectedSupplier.outstanding_balance}</div>
              </div>
              <button
                onClick={() => {
                  setPaymentForm({
                    amount: selectedSupplier.outstanding_balance.toString(),
                    payment_mode: 'bank_transfer',
                    reference_id: '',
                    notes: '',
                  });
                  setShowPaymentModal(true);
                }}
                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-lg cursor-pointer"
              >
                Record Payment
              </button>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">Ledger Journal Entries</h4>
              {supplierLedger.length === 0 ? (
                <div className="text-center py-8 text-slate-500">No journal transactions recorded.</div>
              ) : (
                supplierLedger.map((item) => (
                  <div key={item.id} className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white uppercase text-[11px]">{item.transaction_type.replace('_', ' ')}</span>
                      <span className="text-slate-500 text-[10px]">{item.transaction_date}</span>
                    </div>
                    <div className="text-slate-400 text-[11px]">{item.notes || item.reference_number || '—'}</div>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 font-mono">
                      <div>
                        {parseFloat(item.debit) > 0 && <span className="text-rose-400 font-bold">Debit: +₹{item.debit}</span>}
                        {parseFloat(item.credit) > 0 && <span className="text-emerald-400 font-bold">Credit: -₹{item.credit}</span>}
                      </div>
                      <span className="text-slate-400 text-[11px]">Balance: ₹{item.running_balance}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Purchases;
