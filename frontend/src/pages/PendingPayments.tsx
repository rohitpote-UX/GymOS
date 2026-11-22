import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  DollarSign,
  Download,
  Eye,
  FileText,
  Filter,
  MessageCircle,
  Printer,
  Receipt,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  User,
  X,
} from 'lucide-react';
import api, { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { submitWithOutbox } from '../lib/outbox';
import { formatCurrency, formatDate } from '../lib/formatters';

interface PaymentAllocationItem {
  id: number;
  amount: number;
  allocated_at: string;
  payment?: {
    id: number;
    receipt_number: string;
    amount: number;
    payment_method: string;
    payment_date: string;
  };
}

interface InvoiceItem {
  id: number;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  subtotal: number;
  discount_type: string;
  discount_value: number;
  discount_amount: number;
  discount_reason?: string;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  status: string;
  effective_status?: string;
  days_overdue?: number;
  notes?: string;
  member?: {
    id: number;
    member_code: string;
    first_name: string;
    last_name?: string;
    phone: string;
  };
  branch?: {
    id: number;
    name: string;
    code: string;
  };
  membership?: {
    id: number;
    plan?: {
      id: number;
      name: string;
      price: number;
    };
  };
  allocations?: PaymentAllocationItem[];
}

interface PendingKPIs {
  total_outstanding: number;
  overdue_amount: number;
  partial_invoices_count: number;
  collected_today: number;
}

export default function PendingPayments() {
  const { t, i18n } = useTranslation();
  const { user, activeBranchId } = useAuth();
  const branches = user?.branches || [];

  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [kpis, setKpis] = useState<PendingKPIs>({
    total_outstanding: 0,
    overdue_amount: 0,
    partial_invoices_count: 0,
    collected_today: 0,
  });
  const [loading, setLoading] = useState(true);
  const [statusTab, setStatusTab] = useState<'pending' | 'overdue' | 'partially_paid' | 'unpaid' | 'all'>('pending');
  const [search, setSearch] = useState('');
  const [fromDue, setFromDue] = useState('');
  const [toDue, setToDue] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState<number | string>(activeBranchId || '');

  // Modals state
  const [collectModalInvoice, setCollectModalInvoice] = useState<InvoiceItem | null>(null);
  const [reminderModalInvoice, setReminderModalInvoice] = useState<InvoiceItem | null>(null);
  const [detailsModalInvoice, setDetailsModalInvoice] = useState<InvoiceItem | null>(null);

  // Collect Payment Form state
  const [collectAmount, setCollectAmount] = useState('');
  const [collectMethod, setCollectMethod] = useState('cash');
  const [collectRef, setCollectRef] = useState('');
  const [collectDate, setCollectDate] = useState(new Date().toISOString().split('T')[0]);
  const [collectNotes, setCollectNotes] = useState('');
  const [collecting, setCollecting] = useState(false);

  // Reminder Form state
  const [reminderLang, setReminderLang] = useState(i18n.language || 'mr');
  const [sendingReminder, setSendingReminder] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const fetchPendingPayments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusTab) params.append('status', statusTab);
      if (search) params.append('search', search);
      if (selectedBranchId) params.append('branch_id', String(selectedBranchId));
      if (fromDue) params.append('from_due', fromDue);
      if (toDue) params.append('to_due', toDue);

      const res = await api.get<{ kpis: PendingKPIs; invoices: { data: InvoiceItem[] } }>(
        `/pending-payments?${params.toString()}`
      );
      setKpis(res.data.kpis);
      setInvoices(res.data.invoices.data || []);
    } catch (err) {
      showToast(errorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingPayments();
  }, [statusTab, selectedBranchId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPendingPayments();
  };

  const openCollectModal = (inv: InvoiceItem) => {
    setCollectModalInvoice(inv);
    setCollectAmount(String(inv.balance_due));
    setCollectMethod('upi');
    setCollectRef('');
    setCollectDate(new Date().toISOString().split('T')[0]);
    setCollectNotes('');
  };

  const handleConfirmCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectModalInvoice) return;

    const amt = parseFloat(collectAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast('Please enter a valid amount greater than 0', 'error');
      return;
    }

    if (amt > collectModalInvoice.balance_due) {
      showToast(`Amount cannot exceed pending balance of ₹${collectModalInvoice.balance_due}`, 'error');
      return;
    }

    setCollecting(true);
    try {
      const payload = {
        amount: amt,
        payment_method: collectMethod,
        payment_date: collectDate,
        reference_id: collectRef || null,
        notes: collectNotes || null,
      };

      const desc = `Udhar Collection ₹${amt} for ${collectModalInvoice.member?.first_name || 'Member'}`;
      const res = await submitWithOutbox(`/pending-payments/${collectModalInvoice.id}/collect`, payload, desc);

      if (res.queued) {
        showToast(`Collection of ₹${amt} queued offline in Outbox. (Syncing upon reconnection)`);
      } else {
        showToast(`Success: ₹${amt} collected! Receipt generated.`);
      }

      setCollectModalInvoice(null);
      fetchPendingPayments();
    } catch (err) {
      showToast(errorMessage(err), 'error');
    } finally {
      setCollecting(false);
    }
  };

  const handleSendReminder = async () => {
    if (!reminderModalInvoice) return;
    setSendingReminder(true);
    try {
      const res = await api.post<{ success: boolean; message: string; phone: string }>(
        `/pending-payments/${reminderModalInvoice.id}/reminder`,
        { language: reminderLang }
      );

      // Open WhatsApp web or intent with formatted message
      const encodedMsg = encodeURIComponent(res.data.message);
      const cleanPhone = (res.data.phone || '').replace(/[^0-9]/g, '');
      const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
      window.open(`https://wa.me/${formattedPhone}?text=${encodedMsg}`, '_blank');

      showToast('Reminder logged & WhatsApp dispatched successfully!');
      setReminderModalInvoice(null);
    } catch (err) {
      showToast(errorMessage(err), 'error');
    } finally {
      setSendingReminder(false);
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" /> Paid (पूर्ण)
          </span>
        );
      case 'overdue':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20 animate-pulse">
            <AlertTriangle className="w-3 h-3" /> Overdue (थकबाकी)
          </span>
        );
      case 'partially_paid':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <Clock className="w-3 h-3" /> Partial (अंशतः)
          </span>
        );
      case 'unpaid':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-500/10 text-slate-400 border border-slate-500/20">
            <Clock className="w-3 h-3" /> Unpaid (बाकी)
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Toast Notification */}
      {toastMsg && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-2xl shadow-2xl flex items-center gap-3 border text-sm font-semibold transition-all ${
            toastMsg.type === 'error'
              ? 'bg-rose-950/90 text-rose-200 border-rose-800'
              : 'bg-emerald-950/90 text-emerald-200 border-emerald-800'
          }`}
        >
          {toastMsg.type === 'error' ? <AlertTriangle className="w-5 h-5 text-rose-400" /> : <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-500 border border-rose-500/20">
              Smart Gym Finance
            </span>
            <span className="text-xs text-slate-400">Udhar & Installment Tracker</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-1 flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-rose-500" />
            <span>Pending Payments / बाकी रक्कम (Udhar)</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time balance tracking, multi-installment collections, automated WhatsApp reminders & receipts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {branches.length > 1 && (
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#303030] text-slate-700 dark:text-slate-200"
            >
              <option value="">All Branches (सर्व शाखा)</option>
              {branches.map((b: any) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={fetchPendingPayments}
            className="p-2.5 rounded-xl bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#303030] hover:bg-slate-100 dark:hover:bg-[#252525] text-slate-500 dark:text-slate-300 cursor-pointer transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-rose-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* TOP 4 KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Outstanding */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#151515] border border-slate-200 dark:border-[#282828] shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Outstanding
            </span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400 font-mono tracking-tight">
              ₹{Number(kpis.total_outstanding || 0).toLocaleString('en-IN')}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">एकूण येणे बाकी रक्कम (All gym dues)</p>
        </div>

        {/* KPI 2: Overdue Amount */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#151515] border border-slate-200 dark:border-[#282828] shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Overdue Amount
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 font-mono tracking-tight">
              ₹{Number(kpis.overdue_amount || 0).toLocaleString('en-IN')}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">थकबाकी (Due date expired)</p>
        </div>

        {/* KPI 3: Partial Invoices Count */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#151515] border border-slate-200 dark:border-[#282828] shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Partial Invoices
            </span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
              {kpis.partial_invoices_count || 0}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">अंशतः भरलेली बिले (Active installments)</p>
        </div>

        {/* KPI 4: Collected Today */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#151515] border border-slate-200 dark:border-[#282828] shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Collected Today
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
              ₹{Number(kpis.collected_today || 0).toLocaleString('en-IN')}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">आज जमा झालेले (Cash / UPI / Card)</p>
        </div>
      </div>

      {/* FILTER TABS & SEARCH BAR */}
      <div className="bg-white dark:bg-[#151515] border border-slate-200 dark:border-[#282828] rounded-3xl p-4 sm:p-5 space-y-4">
        {/* Status Tabs */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#252525] pb-3 overflow-x-auto no-scrollbar gap-2">
          <div className="flex items-center gap-1.5 shrink-0">
            {[
              { id: 'pending', label: 'All Pending (सर्व बाकी)' },
              { id: 'overdue', label: 'Overdue (थकबाकी)' },
              { id: 'partially_paid', label: 'Partially Paid (अंशतः)' },
              { id: 'unpaid', label: 'Zero Paid (अद्याप न भरलेले)' },
              { id: 'all', label: 'All History (सर्व)' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                  statusTab === tab.id
                    ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#202020]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <span className="text-[11px] font-bold text-slate-400 shrink-0">
            {invoices.length} {invoices.length === 1 ? 'Record' : 'Records'}
          </span>
        </div>

        {/* Search & Date Controls */}
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search member name, phone, member ID, or invoice number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl text-xs bg-slate-50 dark:bg-[#1d1d1d] border border-slate-200 dark:border-[#303030] text-slate-900 dark:text-white focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="sm:col-span-2">
            <input
              type="date"
              value={fromDue}
              onChange={(e) => setFromDue(e.target.value)}
              placeholder="From Due Date"
              className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-[#1d1d1d] border border-slate-200 dark:border-[#303030] text-slate-900 dark:text-white"
            />
          </div>

          <div className="sm:col-span-2">
            <input
              type="date"
              value={toDue}
              onChange={(e) => setToDue(e.target.value)}
              placeholder="To Due Date"
              className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-[#1d1d1d] border border-slate-200 dark:border-[#303030] text-slate-900 dark:text-white"
            />
          </div>

          <div className="sm:col-span-2 flex items-center gap-2">
            <button
              type="submit"
              className="w-full py-2 px-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold cursor-pointer transition-colors"
            >
              Filter
            </button>
            {(search || fromDue || toDue) && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setFromDue('');
                  setToDue('');
                  fetchPendingPayments();
                }}
                className="p-2 rounded-xl bg-slate-100 dark:bg-[#202020] text-slate-400 hover:text-white cursor-pointer"
                title="Clear filters"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </form>

        {/* INVOICES TABLE */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-rose-500 mb-2" />
              Loading financial records...
            </div>
          ) : invoices.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <p className="font-bold text-slate-700 dark:text-slate-300 text-sm">No Pending Balances Found!</p>
              <p className="text-[11px]">All dues in this category are completely cleared. Keep up the great collection work.</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/70 dark:bg-[#1b1b1b] text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-[#282828]">
                <tr>
                  <th className="py-3 px-3">Member</th>
                  <th className="py-3 px-3">Package / Plan</th>
                  <th className="py-3 px-3">Invoice #</th>
                  <th className="py-3 px-3 text-right">Total Payable</th>
                  <th className="py-3 px-3 text-right">Paid</th>
                  <th className="py-3 px-3 text-right">Pending (बाकी)</th>
                  <th className="py-3 px-3">Due Date</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#252525] text-slate-700 dark:text-slate-300">
                {invoices.map((inv) => {
                  const balance = Number(inv.balance_due || 0);
                  const isOverdue = inv.effective_status === 'overdue' || (inv.days_overdue && inv.days_overdue > 0);

                  return (
                    <tr
                      key={inv.id}
                      className={`hover:bg-slate-50 dark:hover:bg-[#1e1e1e] transition-colors ${
                        isOverdue ? 'bg-rose-500/5' : ''
                      }`}
                    >
                      {/* Member */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center font-bold text-xs">
                            {inv.member?.first_name?.charAt(0) || 'M'}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white block">
                              {inv.member ? `${inv.member.first_name} ${inv.member.last_name || ''}` : 'Member'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {inv.member?.phone} • {inv.member?.member_code}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Package */}
                      <td className="py-3 px-3">
                        <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                          {inv.membership?.plan?.name || 'Membership Plan'}
                        </span>
                        <span className="text-[10px] text-slate-400">{inv.branch?.name || 'Main Club'}</span>
                      </td>

                      {/* Invoice No */}
                      <td className="py-3 px-3 font-mono font-medium text-slate-500 dark:text-slate-400 text-[11px]">
                        <div>{inv.invoice_number}</div>
                        <div className="text-[10px] text-slate-400">{inv.invoice_date}</div>
                      </td>

                      {/* Total */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                        ₹{Number(inv.total_amount).toLocaleString('en-IN')}
                        {Number(inv.discount_amount) > 0 && (
                          <div className="text-[9px] text-emerald-500 font-normal">
                            (₹{Number(inv.discount_amount).toLocaleString('en-IN')} off)
                          </div>
                        )}
                      </td>

                      {/* Paid */}
                      <td className="py-3 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                        ₹{Number(inv.paid_amount).toLocaleString('en-IN')}
                      </td>

                      {/* Pending Balance */}
                      <td className="py-3 px-3 text-right font-mono font-black text-rose-600 dark:text-rose-400 text-sm">
                        ₹{balance.toLocaleString('en-IN')}
                      </td>

                      {/* Due Date */}
                      <td className="py-3 px-3">
                        <div className="font-medium text-[11px] text-slate-700 dark:text-slate-300">
                          {inv.due_date}
                        </div>
                        {isOverdue && (
                          <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-500/20 text-rose-400">
                            {inv.days_overdue} days overdue
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center">{getStatusBadge(inv.effective_status || inv.status)}</td>

                      {/* Action */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {balance > 0 && (
                            <button
                              onClick={() => openCollectModal(inv)}
                              className="px-2.5 py-1 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                            >
                              <span>Collect</span>
                            </button>
                          )}

                          {balance > 0 && (
                            <button
                              onClick={() => {
                                setReminderModalInvoice(inv);
                                setReminderLang(inv.member ? 'mr' : 'en');
                              }}
                              className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 cursor-pointer transition-colors"
                              title="Send WhatsApp Reminder"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => setDetailsModalInvoice(inv)}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-[#252525] hover:bg-slate-200 dark:hover:bg-[#303030] text-slate-400 hover:text-white cursor-pointer transition-colors"
                            title="View Invoice & Receipts"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 1: COLLECT PAYMENT INSTALLMENT                          */}
      {/* ------------------------------------------------------------- */}
      {collectModalInvoice && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-[#303030] rounded-3xl w-full max-w-lg shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#252525] pb-3">
              <div>
                <span className="text-[10px] font-black uppercase text-rose-500 tracking-wider">
                  Payment Collection
                </span>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Collect Installment (रक्कम जमा करा)
                </h3>
              </div>
              <button
                onClick={() => setCollectModalInvoice(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-[#202020] text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Member & Invoice Summary Banner */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#282828] flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  {collectModalInvoice.member?.first_name} {collectModalInvoice.member?.last_name}
                </span>
                <span className="text-[10px] text-slate-400">
                  {collectModalInvoice.membership?.plan?.name} • Inv #{collectModalInvoice.invoice_number}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Pending Due</span>
                <span className="text-lg font-black text-rose-500 font-mono">
                  ₹{Number(collectModalInvoice.balance_due).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <form onSubmit={handleConfirmCollection} className="space-y-4">
              {/* Amount Input */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Amount Received (जमा रक्कम ₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  max={collectModalInvoice.balance_due}
                  value={collectAmount}
                  onChange={(e) => setCollectAmount(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#1c1c1c] border border-slate-200 dark:border-[#303030] text-slate-900 dark:text-white font-mono text-base font-bold focus:outline-none focus:border-rose-500"
                />

                {/* Preset Fast Click Buttons */}
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-[10px] text-slate-400 font-medium">Presets:</span>
                  <button
                    type="button"
                    onClick={() => setCollectAmount(String(collectModalInvoice.balance_due))}
                    className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 cursor-pointer"
                  >
                    Full (₹{collectModalInvoice.balance_due})
                  </button>
                  {[500, 1000, 2000]
                    .filter((v) => v < collectModalInvoice.balance_due)
                    .map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setCollectAmount(String(val))}
                        className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-[#252525] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#303030] cursor-pointer"
                      >
                        ₹{val}
                      </button>
                    ))}
                </div>

                {/* Live Calculated Balance Preview */}
                <div className="mt-2 text-right">
                  <span className="text-[11px] font-semibold text-slate-400">
                    Remaining balance after payment:{' '}
                    <strong className="text-slate-800 dark:text-white font-mono">
                      ₹{Math.max(0, collectModalInvoice.balance_due - (parseFloat(collectAmount) || 0)).toLocaleString('en-IN')}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Payment Method */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Payment Method (पद्धत) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={collectMethod}
                    onChange={(e) => setCollectMethod(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1c1c1c] border border-slate-200 dark:border-[#303030] text-xs font-semibold text-slate-900 dark:text-white"
                  >
                    <option value="upi">UPI (GPay, PhonePe, Paytm)</option>
                    <option value="cash">Cash (रोख)</option>
                    <option value="card">Card / POS Machine</option>
                    <option value="bank_transfer">Bank Transfer (NEFT/IMPS)</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Payment Date (तारीख)
                  </label>
                  <input
                    type="date"
                    value={collectDate}
                    onChange={(e) => setCollectDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1c1c1c] border border-slate-200 dark:border-[#303030] text-xs font-semibold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Reference ID / Cheque # */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Transaction Reference (Optional)
                </label>
                <input
                  type="text"
                  placeholder="UPI Txn ID, UTR #, or Cheque number"
                  value={collectRef}
                  onChange={(e) => setCollectRef(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1c1c1c] border border-slate-200 dark:border-[#303030] text-xs text-slate-900 dark:text-white font-mono"
                />
              </div>

              {/* Remarks */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Remarks / Staff Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="E.g., Promised next installment on 15th"
                  value={collectNotes}
                  onChange={(e) => setCollectNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1c1c1c] border border-slate-200 dark:border-[#303030] text-xs text-slate-900 dark:text-white"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-[#252525]">
                <button
                  type="button"
                  onClick={() => setCollectModalInvoice(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={collecting}
                  className="px-5 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-lg shadow-rose-500/20"
                >
                  {collecting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Recording...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm & Generate Receipt</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 2: SEND TRILINGUAL WHATSAPP REMINDER                    */}
      {/* ------------------------------------------------------------- */}
      {reminderModalInvoice && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-[#303030] rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#252525] pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">WhatsApp Payment Reminder</h3>
                  <p className="text-[10px] text-slate-400">Trilingual payment notice with live balances</p>
                </div>
              </div>
              <button
                onClick={() => setReminderModalInvoice(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-[#202020] text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Recipient Info */}
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#282828] text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Recipient:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {reminderModalInvoice.member?.first_name} {reminderModalInvoice.member?.last_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Mobile:</span>
                <span className="font-mono text-slate-900 dark:text-white">{reminderModalInvoice.member?.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Pending Amount:</span>
                <span className="font-mono font-bold text-rose-500">
                  ₹{Number(reminderModalInvoice.balance_due).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Due Date:</span>
                <span className="font-mono text-slate-300">{reminderModalInvoice.due_date}</span>
              </div>
            </div>

            {/* Language Selection */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Template Language (भाषा निवडा)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { code: 'mr', name: 'मराठी (Marathi)' },
                  { code: 'hi', name: 'हिंदी (Hindi)' },
                  { code: 'en', name: 'English' },
                ].map((l) => (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => setReminderLang(l.code)}
                    className={`py-2 px-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                      reminderLang === l.code
                        ? 'bg-rose-500/10 text-rose-500 border-rose-500/40'
                        : 'bg-slate-50 dark:bg-[#1a1a1a] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-[#2e2e2e]'
                    }`}
                  >
                    {l.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Message Preview */}
            <div className="p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 text-xs text-slate-700 dark:text-slate-300 font-sans leading-relaxed">
              <span className="text-[10px] font-bold text-emerald-500 uppercase block mb-1">Message Preview</span>
              {reminderLang === 'mr' && (
                <p>
                  नमस्कार <strong>{reminderModalInvoice.member?.first_name}</strong>,{' '}
                  <strong>{user?.gym?.name || 'जिम'}</strong> कडून नम्र आठवण. आपल्या जिम मेंबरशिपचे{' '}
                  <strong>₹{Number(reminderModalInvoice.balance_due).toLocaleString('en-IN')}</strong> पेमेंट बाकी आहे
                  (शेवटची तारीख: {reminderModalInvoice.due_date}). कृपया आपल्या सोयीनुसार पेमेंट पूर्ण करावे. धन्यवाद!
                </p>
              )}
              {reminderLang === 'hi' && (
                <p>
                  नमस्ते <strong>{reminderModalInvoice.member?.first_name}</strong>,{' '}
                  <strong>{user?.gym?.name || 'जिम'}</strong> की ओर से अनुस्मारक। आपकी जिम सदस्यता का{' '}
                  <strong>₹{Number(reminderModalInvoice.balance_due).toLocaleString('en-IN')}</strong> बकाया है (अंतिम
                  तिथि: {reminderModalInvoice.due_date})। कृपया अपनी सुविधानुसार भुगतान पूरा करें। धन्यवाद!
                </p>
              )}
              {reminderLang === 'en' && (
                <p>
                  Hello <strong>{reminderModalInvoice.member?.first_name}</strong>, this is a gentle reminder from{' '}
                  <strong>{user?.gym?.name || 'Gym'}</strong>. Your gym membership has an outstanding balance of{' '}
                  <strong>₹{Number(reminderModalInvoice.balance_due).toLocaleString('en-IN')}</strong> (Due Date:{' '}
                  {reminderModalInvoice.due_date}). Please complete your payment at your earliest convenience. Thank you!
                </p>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-[#252525]">
              <button
                type="button"
                onClick={() => setReminderModalInvoice(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendReminder}
                disabled={sendingReminder}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-lg shadow-emerald-600/20"
              >
                {sendingReminder ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Send via WhatsApp</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 3: INVOICE DETAILS & PRINTABLE RECEIPT PREVIEW         */}
      {/* ------------------------------------------------------------- */}
      {detailsModalInvoice && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-[#303030] rounded-3xl w-full max-w-2xl shadow-2xl p-6 sm:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-150">
            {/* Header with Print */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#252525] pb-4">
              <div>
                <span className="text-[10px] font-black uppercase text-rose-500 tracking-wider">Official Invoice</span>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  {detailsModalInvoice.invoice_number}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#202020] hover:bg-slate-200 dark:hover:bg-[#282828] text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-rose-500" />
                  <span>Print</span>
                </button>
                <button
                  onClick={() => setDetailsModalInvoice(null)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-[#202020] text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Receipt Body */}
            <div className="space-y-5 print:p-0">
              {/* Gym & Member metadata */}
              <div className="grid grid-cols-2 gap-4 text-xs pb-4 border-b border-slate-100 dark:border-[#252525]">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Billed To (सदस्य)</span>
                  <span className="font-black text-slate-900 dark:text-white text-sm block">
                    {detailsModalInvoice.member?.first_name} {detailsModalInvoice.member?.last_name}
                  </span>
                  <span className="text-slate-400 font-mono text-[11px] block">
                    Phone: {detailsModalInvoice.member?.phone}
                  </span>
                  <span className="text-slate-400 font-mono text-[11px] block">
                    ID: {detailsModalInvoice.member?.member_code}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Facility (शाखा)</span>
                  <span className="font-bold text-slate-900 dark:text-white block">
                    {detailsModalInvoice.branch?.name || 'Main Club'}
                  </span>
                  <span className="text-slate-400 text-[11px] block">Date: {detailsModalInvoice.invoice_date}</span>
                  <span className="text-slate-400 text-[11px] block">Due: {detailsModalInvoice.due_date}</span>
                </div>
              </div>

              {/* Line Items */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-[#1a1a1a] text-slate-400 uppercase text-[10px]">
                    <tr>
                      <th className="py-2 px-3">Description</th>
                      <th className="py-2 px-3 text-right">Subtotal</th>
                      <th className="py-2 px-3 text-right">Discount</th>
                      <th className="py-2 px-3 text-right">Final Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#252525]">
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                        {detailsModalInvoice.membership?.plan?.name || 'Gym Membership'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        ₹{Number(detailsModalInvoice.subtotal).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-500">
                        -₹{Number(detailsModalInvoice.discount_amount).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                        ₹{Number(detailsModalInvoice.total_amount).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Payment Installments Breakdown */}
              <div className="pt-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-2">
                  Payment History & Installments (हप्ते जमा पावती)
                </span>
                {(!detailsModalInvoice.allocations || detailsModalInvoice.allocations.length === 0) ? (
                  <p className="text-xs text-slate-400 italic">No payments collected against this invoice yet.</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-[#252525]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-[#1a1a1a] text-slate-400 text-[10px] uppercase">
                        <tr>
                          <th className="py-2 px-3">Receipt No</th>
                          <th className="py-2 px-3">Date</th>
                          <th className="py-2 px-3">Method</th>
                          <th className="py-2 px-3 text-right">Amount Paid</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-[#252525]">
                        {detailsModalInvoice.allocations.map((alloc) => (
                          <tr key={alloc.id}>
                            <td className="py-2 px-3 font-mono font-semibold text-rose-500">
                              {alloc.payment?.receipt_number || `REC-${alloc.id}`}
                            </td>
                            <td className="py-2 px-3 text-slate-400">{alloc.payment?.payment_date || alloc.allocated_at}</td>
                            <td className="py-2 px-3 uppercase text-slate-400 text-[10px]">
                              {alloc.payment?.payment_method || 'CASH'}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-emerald-500">
                              ₹{Number(alloc.amount).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Total & Outstanding Summary Box */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#282828] flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-400">Total Confirmed Payments:</span>
                  <div className="text-sm font-bold font-mono text-emerald-500">
                    ₹{Number(detailsModalInvoice.paid_amount).toLocaleString('en-IN')}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-semibold text-slate-400">Current Balance Due (बाकी):</span>
                  <div className="text-xl font-black font-mono text-rose-500">
                    ₹{Number(detailsModalInvoice.balance_due).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-[#252525]">
              <button
                type="button"
                onClick={() => setDetailsModalInvoice(null)}
                className="px-5 py-2 rounded-xl bg-slate-100 dark:bg-[#202020] text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-white cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
