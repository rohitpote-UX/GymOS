import React, { useEffect, useState } from 'react';
import { Check, CheckCircle2, Clock, CreditCard, Sparkles, Zap } from 'lucide-react';
import api, { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface SaasPlan {
  id: number;
  name: string;
  code: string;
  price: number;
  interval: string;
  branch_limit: number;
  member_limit: number;
  features: string[];
}

interface BillingPayment {
  id: number;
  razorpay_payment_id: string;
  amount: number;
  created_at: string;
  period_end: string;
}

export const Billing: React.FC = () => {
  const { user, refreshMe } = useAuth();
  const [plans, setPlans] = useState<SaasPlan[]>([]);
  const [payments, setPayments] = useState<BillingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [interval, setInterval] = useState<'month' | 'year'>('month');
  const [processingPlanId, setProcessingPlanId] = useState<number | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchBilling = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ plans: SaasPlan[]; recent_payments: BillingPayment[] }>('/billing');
      setPlans(res.data.plans);
      setPayments(res.data.recent_payments);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBilling();
  }, []);

  const handleCheckout = async (plan: SaasPlan) => {
    setProcessingPlanId(plan.id);
    setError(null);
    setSuccessMessage(null);
    try {
      // 1. Create order
      const orderRes = await api.post<{ razorpay_order_id: string }>('/billing/order', {
        plan_id: plan.id,
        interval,
      });

      const orderId = orderRes.data.razorpay_order_id;
      const fakePaymentId = 'pay_' + Math.random().toString(36).substring(2, 14);

      // 2. Verify payment (Razorpay handler simulation)
      const verifyRes = await api.post<{ message: string }>('/billing/verify', {
        razorpay_order_id: orderId,
        razorpay_payment_id: fakePaymentId,
        razorpay_signature: 'sig_mock_verified',
      });

      setSuccessMessage(verifyRes.data.message);
      await refreshMe();
      await fetchBilling();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setProcessingPlanId(null);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-emerald-400" />
            <span>SaaS Subscription & Plans</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage your Gym Business OS operating license, branches limit, and Razorpay billing
          </p>
        </div>

        {/* Current Status Badge */}
        <div className="bg-[#0f172a] border border-slate-800 px-4 py-2 rounded-xl flex items-center gap-3">
          <Clock className="w-4 h-4 text-emerald-400" />
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Valid Until</span>
            <span className="text-xs font-bold text-white">
              {user?.gym?.subscription_expires_at
                ? new Date(user.gym.subscription_expires_at).toLocaleDateString()
                : '14-Day Free Trial'}
            </span>
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="p-4 bg-emerald-500/15 border border-emerald-500/40 rounded-2xl text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-500/15 border border-rose-500/40 rounded-2xl text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* Interval Selector */}
      <div className="flex justify-center my-4">
        <div className="bg-slate-900 p-1 rounded-xl border border-slate-800 flex items-center">
          <button
            onClick={() => setInterval('month')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              interval === 'month' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-400'
            }`}
          >
            Monthly Billing
          </button>
          <button
            onClick={() => setInterval('year')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              interval === 'year' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-400'
            }`}
          >
            <span>Annual (Save 17%)</span>
            <Sparkles className="w-3 h-3 text-amber-400" />
          </button>
        </div>
      </div>

      {/* Plans Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((p) => {
          const isCurrent = user?.gym?.settings?.saas_plan_code === p.code || (p.code === 'growth');
          const displayPrice = interval === 'year' ? p.price * 10 : p.price;

          return (
            <div
              key={p.id}
              className={`bg-[#0f172a] border rounded-2xl p-6 flex flex-col justify-between relative transition-all ${
                isCurrent
                  ? 'border-emerald-500 shadow-xl shadow-emerald-950/20'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              {isCurrent && (
                <span className="absolute -top-3 left-6 px-3 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black tracking-wider uppercase">
                  Active Plan
                </span>
              )}

              <div>
                <h3 className="text-lg font-black text-white mb-1">{p.name}</h3>
                <p className="text-xs text-slate-400 mb-4">
                  {p.branch_limit} Branch{p.branch_limit > 1 ? 'es' : ''} • Up to {p.member_limit} Members
                </p>

                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-sm text-slate-400 font-semibold">₹</span>
                  <span className="text-3xl font-black text-white">
                    {displayPrice.toLocaleString('en-IN')}
                  </span>
                  <span className="text-xs text-slate-400 ml-1">/{interval}</span>
                </div>

                <ul className="space-y-2.5 text-xs text-slate-300 mb-6">
                  {p.features?.map((feat, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => handleCheckout(p)}
                disabled={processingPlanId === p.id}
                className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
                  isCurrent
                    ? 'bg-slate-800 text-emerald-400 hover:bg-slate-700 border border-emerald-500/30'
                    : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-lg shadow-emerald-950/30'
                }`}
              >
                {processingPlanId === p.id ? 'Processing via Razorpay...' : isCurrent ? 'Renew Current Plan' : 'Upgrade License'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Past Payments History */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl overflow-hidden mt-8">
        <div className="p-4 border-b border-slate-800">
          <h3 className="text-sm font-bold text-white">License Invoices & Razorpay Receipts</h3>
        </div>
        {payments.length > 0 ? (
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Payment ID</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Extended Until</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="py-3 px-4 font-mono text-purple-400">{p.razorpay_payment_id}</td>
                  <td className="py-3 px-4 font-bold text-white">₹{p.amount.toLocaleString('en-IN')}</td>
                  <td className="py-3 px-4 text-emerald-400">{new Date(p.period_end).toLocaleDateString()}</td>
                  <td className="py-3 px-4 text-slate-400">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="py-3 px-4 text-emerald-400 font-medium">Paid</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="py-8 text-center text-slate-500 text-xs">
            No past subscription invoices found.
          </div>
        )}
      </div>
    </div>
  );
};

export default Billing;
