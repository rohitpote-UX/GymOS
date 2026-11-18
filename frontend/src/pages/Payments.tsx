import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Calendar,
  CreditCard,
  Download,
  Filter,
  MessageCircle,
  Plus,
  Receipt,
  RotateCcw,
  Search,
  Undo2,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import api, { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { submitWithOutbox } from '../lib/outbox';
import { openWhatsApp, WhatsAppTemplates } from '../lib/whatsapp';
import { formatCurrency, formatDate, formatNumber } from '../lib/formatters';

interface PaymentItem {
  id: number;
  receipt_number: string;
  type: string;
  amount: number;
  discount_amount?: number;
  balance_after_payment?: number;
  payment_method: string;
  payment_date: string;
  status: string;
  notes?: string;
  member: {
    id: number;
    member_code: string;
    first_name: string;
    last_name?: string;
    phone: string;
  };
  branch?: {
    id: number;
    name: string;
  };
  membership?: {
    id: number;
    plan?: {
      name: string;
    };
  };
}

interface MemberSummary {
  id: number;
  first_name: string;
  last_name?: string;
  member_code: string;
  phone: string;
}

interface MembershipPlan {
  id: number;
  name: string;
  price: number;
  duration_days: number;
}

export default function Payments() {
  const { t, i18n } = useTranslation();
  const { user, activeBranchId } = useAuth();
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [summary, setSummary] = useState({ total_amount: 0, total_refunded: 0, net_amount: 0 });
  const [loading, setLoading] = useState(true);

  // Modal State
  const [collectModalOpen, setCollectModalOpen] = useState(false);
  const [refundModalPayment, setRefundModalPayment] = useState<PaymentItem | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundNotes, setRefundNotes] = useState('');
  const [refundMethod, setRefundMethod] = useState('cash');

  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form Fields
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [referenceId, setReferenceId] = useState('');
  const [notes, setNotes] = useState('');

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const res = await api.get<{
        payments: { data: PaymentItem[] };
        summary: { total_amount: number; total_refunded: number; net_amount: number };
      }>('/payments');
      setPayments(res.data.payments.data || []);
      setSummary(res.data.summary || { total_amount: 0, total_refunded: 0, net_amount: 0 });
    } catch {
      // offline or error
    } finally {
      setLoading(false);
    }
  };

  const fetchLookups = async () => {
    try {
      const [membersRes, plansRes] = await Promise.all([
        api.get<{ data: MemberSummary[] }>('/members?per_page=100'),
        api.get<MembershipPlan[]>('/membership-plans?active=1'),
      ]);
      setMembers(membersRes.data.data || []);
      setPlans(plansRes.data || []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchPayments();
    fetchLookups();
  }, [activeBranchId]);

  const handleCollectPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberId || !amount) return;

    setSaving(true);
    setToastMessage(null);
    try {
      const payload: Record<string, unknown> = {
        member_id: parseInt(selectedMemberId, 10),
        amount: parseFloat(amount),
        payment_method: paymentMethod,
        reference_id: referenceId || null,
        notes: notes || null,
        branch_id: activeBranchId,
      };

      if (selectedPlanId) {
        payload.membership_plan_id = parseInt(selectedPlanId, 10);
      }

      const selectedMem = members.find((m) => m.id === parseInt(selectedMemberId, 10));
      const desc = `Fee Collection ₹${amount} for ${selectedMem?.first_name || 'Member'}`;

      const res = await submitWithOutbox('/payments', payload, desc);

      if (res.queued) {
        setToastMessage(`Payment of ₹${amount} queued offline in Outbox. (Pending server confirmation upon reconnection).`);
      } else {
        setToastMessage(`Success: Payment of ₹${amount} collected! Receipt generated.`);
      }

      setCollectModalOpen(false);
      resetForm();
      fetchPayments();
    } catch (err) {
      setToastMessage(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleProcessRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundModalPayment) return;

    setSaving(true);
    try {
      await api.post(`/payments/${refundModalPayment.id}/refund`, {
        refund_amount: parseFloat(refundAmount),
        notes: refundNotes,
        payment_method: refundMethod,
      });

      setToastMessage(`Refund of ₹${refundAmount} processed successfully.`);
      setRefundModalPayment(null);
      setRefundAmount('');
      setRefundNotes('');
      fetchPayments();
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setSelectedMemberId('');
    setSelectedPlanId('');
    setAmount('');
    setPaymentMethod('upi');
    setReferenceId('');
    setNotes('');
  };

  const sendReceiptWhatsApp = (p: PaymentItem) => {
    const text = WhatsAppTemplates.paymentReceipt({
      gymName: user?.gym?.name || 'Our Gym',
      memberName: `${p.member.first_name} ${p.member.last_name || ''}`.trim(),
      receiptNumber: p.receipt_number,
      amount: p.amount,
      paymentMethod: p.payment_method,
      planName: p.membership?.plan?.name || 'Gym Subscription',
    });
    openWhatsApp(p.member.phone, text);
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Receipt className="w-6 h-6 text-emerald-400" />
            <span>POS Billing & Member Ledger</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Collect fees, issue GST/tax invoices, track payment modes, and process audit refunds
          </p>
        </div>

        <button
          onClick={() => {
            resetForm();
            setCollectModalOpen(true);
          }}
          className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-lg shadow-emerald-950/40 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Collect Fee Payment</span>
        </button>
      </div>

      {toastMessage && (
        <div className="p-3 bg-slate-800 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center justify-between">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#0f172a] border border-slate-800 p-5 rounded-2xl flex flex-col justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            {t('finance.total_collected', 'Gross Collections')}
          </span>
          <div className="mt-2 text-2xl font-black text-emerald-400 font-mono">
            {formatCurrency(summary.total_amount, i18n.language)}
          </div>
          <span className="text-[11px] text-slate-500 mt-1">Total completed payments</span>
        </div>

        <div className="bg-[#0f172a] border border-slate-800 p-5 rounded-2xl flex flex-col justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            {t('finance.total_expenses', 'Total Refunded')}
          </span>
          <div className="mt-2 text-2xl font-black text-rose-400 font-mono">
            {formatCurrency(summary.total_refunded, i18n.language)}
          </div>
          <span className="text-[11px] text-slate-500 mt-1">Cancellations & adjustments</span>
        </div>

        <div className="bg-[#0f172a] border border-slate-800 p-5 rounded-2xl flex flex-col justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            {t('finance.net_cash_flow', 'Net Revenue')}
          </span>
          <div className="mt-2 text-2xl font-black text-white font-mono">
            {formatCurrency(summary.net_amount, i18n.language)}
          </div>
          <span className="text-[11px] text-slate-500 mt-1">Net cash retained</span>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl overflow-hidden">
        {payments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/60 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Receipt #</th>
                  <th className="py-3.5 px-4">Member</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Plan / Package</th>
                  <th className="py-3.5 px-4">Amount</th>
                  <th className="py-3.5 px-4">Method</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {payments.map((p) => {
                  const isRefund = p.type === 'refund';
                  return (
                    <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-white">{p.receipt_number}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white">
                          {p.member?.first_name} {p.member?.last_name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">{p.member?.member_code}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            isRefund
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          }`}
                        >
                          {isRefund ? 'REFUND' : 'PAYMENT'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">
                        {p.membership?.plan?.name || (isRefund ? 'Refund Voucher' : 'Direct Fee')}
                      </td>
                      <td className={`py-3.5 px-4 font-mono font-bold text-sm ${isRefund ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {isRefund ? '-' : ''}₹{Number(p.amount).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-md text-[10px] bg-slate-800 text-slate-300 font-mono uppercase">
                          {p.payment_method}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 font-mono">{p.payment_date}</td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isRefund && (
                            <>
                              <button
                                onClick={() => sendReceiptWhatsApp(p)}
                                title="Send WhatsApp Receipt"
                                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 border border-slate-700 text-xs inline-flex items-center gap-1 cursor-pointer"
                              >
                                <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Receipt</span>
                              </button>
                              <button
                                onClick={() => {
                                  setRefundModalPayment(p);
                                  setRefundAmount(String(p.amount));
                                  setRefundNotes(`Refund for receipt ${p.receipt_number}`);
                                }}
                                title="Issue Refund"
                                className="p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 cursor-pointer transition-colors"
                              >
                                <Undo2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-14 text-center text-slate-500 text-xs">
            <Receipt className="w-8 h-8 text-slate-700 mx-auto mb-2" />
            <p>No payment records recorded yet.</p>
          </div>
        )}
      </div>

      {/* Collect Payment Modal */}
      {collectModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-400" />
                <span>Collect Member Payment</span>
              </h3>
              <button onClick={() => setCollectModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCollectPayment} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Select Member *</label>
                <select
                  required
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Select member...</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.first_name} {m.last_name} ({m.member_code}) - {m.phone}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Renew Package (Optional)</label>
                <select
                  value={selectedPlanId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedPlanId(id);
                    const p = plans.find((x) => x.id === parseInt(id, 10));
                    if (p) setAmount(p.price.toString());
                  }}
                  className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">No Plan (Partial Payment / Dues Clear)</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (₹{p.price})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Payment Amount (₹) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-base font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="upi">UPI / GPay / QR</option>
                    <option value="cash">Cash (Updates Drawer)</option>
                    <option value="card">Card / POS</option>
                    <option value="bank_transfer">Bank Transfer / NEFT</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Reference / UTR #</label>
                  <input
                    type="text"
                    placeholder="UPI-123456"
                    value={referenceId}
                    onChange={(e) => setReferenceId(e.target.value)}
                    className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Notes / Remarks</label>
                <textarea
                  rows={2}
                  placeholder="Payment remarks..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setCollectModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold cursor-pointer transition-colors"
                >
                  {saving ? 'Recording...' : 'Collect Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Process Refund Modal */}
      {refundModalPayment && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Undo2 className="w-5 h-5 text-rose-500" />
                <span>Process Refund: {refundModalPayment.receipt_number}</span>
              </h3>
              <button onClick={() => setRefundModalPayment(null)} className="text-slate-400 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleProcessRefund} className="space-y-3.5 text-xs">
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                <div className="text-slate-400">Member: <strong className="text-white">{refundModalPayment.member.first_name} {refundModalPayment.member.last_name}</strong></div>
                <div className="text-slate-400">Original Amount: <strong className="text-emerald-400">₹{refundModalPayment.amount}</strong></div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Refund Amount (₹) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  max={refundModalPayment.amount}
                  step="0.01"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-base font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Refund Mode *</label>
                <select
                  value={refundMethod}
                  onChange={(e) => setRefundMethod(e.target.value)}
                  className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="cash">Cash (Deducts from Drawer)</option>
                  <option value="upi">UPI / GPay</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Reason / Notes *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Reason for refund..."
                  value={refundNotes}
                  onChange={(e) => setRefundNotes(e.target.value)}
                  className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setRefundModalPayment(null)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold cursor-pointer transition-colors"
                >
                  {saving ? 'Processing...' : 'Confirm Refund'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
