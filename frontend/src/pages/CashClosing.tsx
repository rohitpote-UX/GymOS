import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  DollarSign,
  History,
  Lock,
  Receipt,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Wallet,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface ClosingSummary {
  branch_id: number;
  closing_date: string;
  opening_cash: number;
  cash_collected: number;
  cash_expenses: number;
  expected_cash_in_hand: number;
  total_upi_collected: number;
  total_card_collected: number;
  total_bank_transfer_collected: number;
  total_collections: number;
}

interface ClosingRecord {
  id: number;
  closing_date: string;
  opening_cash: number | string;
  cash_collected: number | string;
  cash_expenses: number | string;
  expected_cash_in_hand: number | string;
  actual_cash_in_hand: number | string;
  cash_discrepancy: number | string;
  total_upi_collected: number | string;
  total_card_collected: number | string;
  status: string;
  notes?: string;
  closed_at?: string;
  closed_by?: { id: number; name: string };
  opened_by?: { id: number; name: string };
}

export default function CashClosing() {
  const { activeBranchId } = useAuth();
  const [summary, setSummary] = useState<ClosingSummary | null>(null);
  const [existingClosing, setExistingClosing] = useState<ClosingRecord | null>(null);
  const [history, setHistory] = useState<ClosingRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Form
  const [actualCash, setActualCash] = useState<string>('');
  const [openingCashInput, setOpeningCashInput] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const params = activeBranchId ? { branch_id: activeBranchId } : {};

      const [resCurrent, resHistory] = await Promise.all([
        api.get('/cash-closings/current', { params }),
        api.get('/cash-closings/history', { params }),
      ]);

      setSummary(resCurrent.data.summary);
      setExistingClosing(resCurrent.data.closing);
      setHistory(resHistory.data.data || resHistory.data || []);

      if (resCurrent.data.summary) {
        setOpeningCashInput(String(resCurrent.data.summary.opening_cash));
      }
    } catch (err: any) {
      console.error('Failed to load cash status', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [activeBranchId]);

  const expected = summary?.expected_cash_in_hand || 0;
  const actualNum = actualCash !== '' ? parseFloat(actualCash) : null;
  const discrepancy = actualNum !== null ? actualNum - expected : null;

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (actualNum === null || isNaN(actualNum)) {
      setError('Please enter the verified cash count in hand.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await api.post('/cash-closings/close', {
        branch_id: activeBranchId,
        opening_cash: parseFloat(openingCashInput) || 0,
        actual_cash_in_hand: actualNum,
        notes,
      });

      setSuccess('Cash register closed and locked successfully for today.');
      fetchStatus();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit cash closing.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Coins className="w-6 h-6 text-emerald-400" />
            Daily Cash Register & Shift Closing
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time shift drawer reconciliation: audit physical cash against collections and expenses.
          </p>
        </div>
        <button
          onClick={fetchStatus}
          className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Refresh Live Register
        </button>
      </div>

      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Register Overview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cash Drawer Calculator */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-400" />
              Live Cash Drawer Balance (Today)
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-[#131b2e] border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>Opening Cash</span>
                  <History className="w-4 h-4 text-slate-500" />
                </div>
                <div className="text-xl font-bold text-white mt-2">
                  ₹{Number(summary?.opening_cash || 0).toLocaleString('en-IN')}
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Start of day float</p>
              </div>

              <div className="bg-[#131b2e] border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>Cash Inflow</span>
                  <ArrowDownRight className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-xl font-bold text-emerald-400 mt-2">
                  +₹{Number(summary?.cash_collected || 0).toLocaleString('en-IN')}
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Cash payments received</p>
              </div>

              <div className="bg-[#131b2e] border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>Cash Outflow</span>
                  <ArrowUpRight className="w-4 h-4 text-rose-400" />
                </div>
                <div className="text-xl font-bold text-rose-400 mt-2">
                  -₹{Number(summary?.cash_expenses || 0).toLocaleString('en-IN')}
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Cash expenses paid</p>
              </div>
            </div>

            {/* Expected Cash in Hand Big Card */}
            <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <span className="text-xs uppercase font-semibold tracking-wider text-emerald-400">
                  Target / Expected Physical Cash in Hand
                </span>
                <div className="text-3xl font-black text-white mt-1">
                  ₹{Number(expected).toLocaleString('en-IN')}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Formula: Opening Cash (₹{summary?.opening_cash || 0}) + Cash In (₹{summary?.cash_collected || 0}) - Cash Out (₹{summary?.cash_expenses || 0})
                </p>
              </div>
              <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-emerald-400">
                <ShieldCheck className="w-8 h-8" />
              </div>
            </div>

            {/* Non-Cash Digital Collections Breakdown */}
            <div className="mt-6 pt-5 border-t border-slate-800">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-3">
                Digital & Bank Collections (Direct to Bank)
              </span>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                    <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
                    <span>UPI / GPay / QR</span>
                  </div>
                  <div className="font-bold text-white text-base">
                    ₹{Number(summary?.total_upi_collected || 0).toLocaleString('en-IN')}
                  </div>
                </div>

                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                    <CreditCard className="w-3.5 h-3.5 text-blue-400" />
                    <span>POS / Card</span>
                  </div>
                  <div className="font-bold text-white text-base">
                    ₹{Number(summary?.total_card_collected || 0).toLocaleString('en-IN')}
                  </div>
                </div>

                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                    <DollarSign className="w-3.5 h-3.5 text-teal-400" />
                    <span>Bank Transfer</span>
                  </div>
                  <div className="font-bold text-white text-base">
                    ₹{Number(summary?.total_bank_transfer_collected || 0).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Shift Close / Verification Form */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400" />
                Shift Closing Audit
              </h2>
              {existingClosing ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  CLOSED TODAY
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  OPEN
                </span>
              )}
            </div>

            {error && (
              <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-3 rounded-xl text-xs flex items-center gap-2 mb-4">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCloseShift} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Opening Cash Float (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  disabled={Boolean(existingClosing)}
                  value={openingCashInput}
                  onChange={(e) => setOpeningCashInput(e.target.value)}
                  className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">
                  Actual Physical Cash Counted (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="Enter drawer cash count"
                  disabled={Boolean(existingClosing)}
                  value={actualCash}
                  onChange={(e) => setActualCash(e.target.value)}
                  className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-base font-bold focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                />
              </div>

              {/* Real-time Discrepancy Indicator */}
              {discrepancy !== null && (
                <div
                  className={`p-3.5 rounded-xl border text-xs ${
                    discrepancy === 0
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : discrepancy < 0
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  }`}
                >
                  <div className="font-bold flex items-center justify-between">
                    <span>
                      {discrepancy === 0
                        ? 'PERFECT BALANCE'
                        : discrepancy < 0
                        ? 'CASH SHORTAGE'
                        : 'CASH EXCESS'}
                    </span>
                    <span className="font-mono text-sm">
                      {discrepancy > 0 ? '+' : ''}₹{discrepancy.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <p className="text-[11px] mt-1 opacity-90">
                    {discrepancy === 0
                      ? 'Counted cash exactly matches system register.'
                      : discrepancy < 0
                      ? `Drawer is short by ₹${Math.abs(discrepancy).toLocaleString('en-IN')}. Verify unrecorded cash expenses or change given.`
                      : `Drawer has ₹${discrepancy.toLocaleString('en-IN')} extra cash.`}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-slate-400 font-medium mb-1">Shift Notes / Remarks</label>
                <textarea
                  rows={2}
                  disabled={Boolean(existingClosing)}
                  placeholder="e.g. All change accounted, minor shortage due to tea purchase..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                />
              </div>

              {!existingClosing ? (
                <button
                  type="submit"
                  disabled={submitting || actualCash === ''}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-bold py-2.5 rounded-xl shadow-lg shadow-emerald-500/20 cursor-pointer transition-colors flex items-center justify-center gap-2 mt-4"
                >
                  <Lock className="w-4 h-4" />
                  {submitting ? 'Locking Register...' : 'Lock & Close Register'}
                </button>
              ) : (
                <div className="p-3 bg-slate-800/80 rounded-xl text-center text-slate-400 text-xs">
                  Register was closed on {existingClosing.closed_at || existingClosing.closing_date} by{' '}
                  <span className="text-white font-semibold">
                    {existingClosing.closed_by?.name || 'Staff'}
                  </span>
                  .
                </div>
              )}
            </form>
          </div>
        </div>
      </div>

      {/* Historical Closings Audit Table */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm">
        <div className="p-4 border-b border-slate-800 flex items-center gap-2">
          <History className="w-4 h-4 text-emerald-400" />
          <h3 className="font-semibold text-white text-xs uppercase tracking-wider">
            Past Shift Closings Audit Log
          </h3>
        </div>

        {history.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No previous cash closing records found for this branch.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/60 font-medium">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Opening</th>
                  <th className="py-3 px-4">Cash In</th>
                  <th className="py-3 px-4">Cash Out</th>
                  <th className="py-3 px-4">Expected</th>
                  <th className="py-3 px-4">Actual Count</th>
                  <th className="py-3 px-4">Discrepancy</th>
                  <th className="py-3 px-4">Closed By</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {history.map((h) => {
                  const disc = Number(h.cash_discrepancy);
                  return (
                    <tr key={h.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 text-white font-mono font-medium">{h.closing_date}</td>
                      <td className="py-3 px-4 text-slate-300 font-mono">₹{Number(h.opening_cash).toLocaleString('en-IN')}</td>
                      <td className="py-3 px-4 text-emerald-400 font-mono">+₹{Number(h.cash_collected).toLocaleString('en-IN')}</td>
                      <td className="py-3 px-4 text-rose-400 font-mono">-₹{Number(h.cash_expenses).toLocaleString('en-IN')}</td>
                      <td className="py-3 px-4 text-white font-mono font-semibold">₹{Number(h.expected_cash_in_hand).toLocaleString('en-IN')}</td>
                      <td className="py-3 px-4 text-white font-mono font-bold">₹{Number(h.actual_cash_in_hand).toLocaleString('en-IN')}</td>
                      <td className="py-3 px-4 font-mono font-bold">
                        {disc === 0 ? (
                          <span className="text-emerald-400">₹0</span>
                        ) : disc < 0 ? (
                          <span className="text-rose-400">-₹{Math.abs(disc).toLocaleString('en-IN')} (Short)</span>
                        ) : (
                          <span className="text-amber-400">+₹{disc.toLocaleString('en-IN')} (Excess)</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-300">{h.closed_by?.name || 'Staff'}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          {h.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
