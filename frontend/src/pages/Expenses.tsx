import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Building,
  Calendar,
  CheckCircle2,
  DollarSign,
  Filter,
  Plus,
  Receipt,
  Search,
  Tag,
  Trash2,
  TrendingDown,
  Wallet,
  Zap,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { formatCurrency, formatDate } from '../lib/formatters';

interface Expense {
  id: number;
  category: string;
  title: string;
  amount: number | string;
  payment_mode: string;
  expense_date: string;
  vendor_name?: string;
  bill_number?: string;
  notes?: string;
  branch?: { id: number; name: string };
  recorder?: { id: number; name: string };
}

interface ExpenseSummary {
  total_amount: number;
  by_category: Record<string, number | string>;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  rent: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
  salaries: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  electricity: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  maintenance: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' },
  marketing: { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/30' },
  cleaning: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  equipment: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  other: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30' },
};

export default function Expenses() {
  const { t } = useTranslation();
  const { activeBranchId } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [modeFilter, setModeFilter] = useState('');
  const [search, setSearch] = useState('');

  // Add Expense Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    category: 'other',
    amount: '',
    payment_mode: 'cash',
    expense_date: new Date().toISOString().split('T')[0],
    vendor_name: '',
    bill_number: '',
    notes: '',
  });

  const resetForm = () => {
    setFormData({
      title: '',
      category: 'other',
      amount: '',
      payment_mode: 'cash',
      expense_date: new Date().toISOString().split('T')[0],
      vendor_name: '',
      bill_number: '',
      notes: '',
    });
    setError(null);
  };

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (categoryFilter) params.category = categoryFilter;
      if (modeFilter) params.payment_mode = modeFilter;
      if (activeBranchId) params.branch_id = String(activeBranchId);

      const res = await api.get('/expenses', { params });
      setExpenses(res.data.expenses?.data || res.data.expenses || []);
      setSummary(res.data.summary || null);
    } catch (err: any) {
      console.error('Failed to load expenses', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [activeBranchId, categoryFilter, modeFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.post('/expenses', {
        ...formData,
        amount: parseFloat(formData.amount),
        branch_id: activeBranchId,
      });
      setSuccess('Expense recorded successfully.');
      setModalOpen(false);
      setFormData({
        title: '',
        category: 'other',
        amount: '',
        payment_mode: 'cash',
        expense_date: new Date().toISOString().split('T')[0],
        vendor_name: '',
        bill_number: '',
        notes: '',
      });
      fetchExpenses();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to record expense.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this expense record?')) return;
    try {
      await api.delete(`/expenses/${id}`);
      fetchExpenses();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete expense.');
    }
  };

  const filteredExpenses = expenses.filter((e) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      e.title.toLowerCase().includes(s) ||
      (e.vendor_name && e.vendor_name.toLowerCase().includes(s)) ||
      (e.bill_number && e.bill_number.toLowerCase().includes(s))
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <TrendingDown className="w-6 h-6 text-rose-500" />
            {t('common.expenses')}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {t('dashboard.monthly_expenses')} & overheads
          </p>
        </div>
        <button
          onClick={() => {
            setError(null);
            setModalOpen(true);
          }}
          className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold px-4 py-2 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Expense
        </button>
      </div>

      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Expenses</span>
            <div className="p-2 bg-rose-500/10 text-rose-400 rounded-xl">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-white">
            {formatCurrency(Number(summary?.total_amount || 0))}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Current filtered period</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Rent & Utilities</span>
            <div className="p-2 bg-purple-500/10 text-purple-400 rounded-xl">
              <Building className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-white">
            {formatCurrency(
              Number(summary?.by_category?.rent || 0) +
              Number(summary?.by_category?.electricity || 0)
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Premises overhead</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Maintenance & Equip</span>
            <div className="p-2 bg-orange-500/10 text-orange-400 rounded-xl">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-white">
            {formatCurrency(
              Number(summary?.by_category?.maintenance || 0) +
              Number(summary?.by_category?.equipment || 0)
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Facility uptime</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Marketing & Staff</span>
            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-white">
            {formatCurrency(
              Number(summary?.by_category?.marketing || 0) +
              Number(summary?.by_category?.salaries || 0)
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Growth & payroll</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-slate-900/40 border border-slate-800/80 p-3 rounded-2xl">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
          <input
            type="text"
            placeholder="Search expense title, vendor, bill number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#131b2e] border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-[#131b2e] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
        >
          <option value="">All Categories</option>
          <option value="rent">Rent</option>
          <option value="salaries">Salaries</option>
          <option value="electricity">Electricity</option>
          <option value="maintenance">Maintenance</option>
          <option value="marketing">Marketing</option>
          <option value="cleaning">Cleaning</option>
          <option value="equipment">Equipment</option>
          <option value="other">Other</option>
        </select>
        <select
          value={modeFilter}
          onChange={(e) => setModeFilter(e.target.value)}
          className="bg-[#131b2e] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
        >
          <option value="">All Payment Modes</option>
          <option value="cash">Cash</option>
          <option value="upi">UPI</option>
          <option value="bank_transfer">Bank Transfer</option>
          <option value="card">Card</option>
          <option value="cheque">Cheque</option>
        </select>
      </div>

      {/* Expenses Table */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading expenses...</div>
        ) : filteredExpenses.length === 0 ? (
          <div className="py-16 text-center flex flex-col items-center justify-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
              <Receipt className="w-7 h-7" />
            </div>
            <div className="max-w-md">
              <p className="text-sm font-semibold text-white">No expenses recorded yet</p>
              <p className="text-xs text-slate-400 mt-1">Log electricity, rent, maintenance bills, or staff salaries.</p>
            </div>
            <button
              onClick={() => {
                resetForm();
                setModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-rose-950/40 cursor-pointer mt-2"
            >
              <Plus className="w-4 h-4" />
              <span>Record Expense</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/60 font-medium">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Expense Title</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Mode</th>
                  <th className="py-3 px-4">Vendor / Bill</th>
                  <th className="py-3 px-4">Recorded By</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredExpenses.map((expense) => {
                  const style = CATEGORY_COLORS[expense.category] || CATEGORY_COLORS.other;
                  return (
                    <tr key={expense.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 text-slate-300 font-mono">
                        {expense.expense_date}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white">{expense.title}</div>
                        {expense.notes && <div className="text-[11px] text-slate-400 truncate max-w-xs">{expense.notes}</div>}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${style.bg} ${style.text} ${style.border}`}>
                          {expense.category.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-rose-400">
                        ₹{Number(expense.amount).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md text-[10px] bg-slate-800 text-slate-300 font-mono">
                          {expense.payment_mode.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {expense.vendor_name || '—'}
                        {expense.bill_number && (
                          <div className="text-[10px] text-slate-500 font-mono">#{expense.bill_number}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {expense.recorder?.name || 'Staff'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleDelete(expense.id)}
                          className="p-1.5 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                          title="Delete Expense"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Expense Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-400" />
                Record Gym Expense
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-3 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Expense Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Electricity Bill Oct, Dumbbell purchase"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="rent">Rent</option>
                    <option value="salaries">Salaries</option>
                    <option value="electricity">Electricity</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="marketing">Marketing</option>
                    <option value="cleaning">Cleaning</option>
                    <option value="equipment">Equipment</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Payment Mode *</label>
                  <select
                    value={formData.payment_mode}
                    onChange={(e) => setFormData({ ...formData, payment_mode: e.target.value })}
                    className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="cash">Cash (Reduces Register)</option>
                    <option value="upi">UPI / GPay / Paytm</option>
                    <option value="bank_transfer">Bank Transfer / NEFT</option>
                    <option value="card">Card / POS</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Expense Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.expense_date}
                    onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                    className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Vendor / Paid To</label>
                  <input
                    type="text"
                    placeholder="e.g. Adani Power, FitFix"
                    value={formData.vendor_name}
                    onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                    className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Bill / Invoice #</label>
                  <input
                    type="text"
                    placeholder="e.g. INV-2026-99"
                    value={formData.bill_number}
                    onChange={(e) => setFormData({ ...formData, bill_number: e.target.value })}
                    className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Notes / Description</label>
                <textarea
                  rows={2}
                  placeholder="Optional details or reason..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-semibold px-5 py-2 rounded-xl shadow-lg shadow-emerald-500/20 cursor-pointer transition-colors"
                >
                  {saving ? 'Saving...' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
