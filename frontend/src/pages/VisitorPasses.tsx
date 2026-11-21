import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  Filter,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  Search,
  Sparkles,
  Ticket,
  User,
  UserCheck,
  Users,
  Wallet,
  X,
  AlertCircle,
  MapPin,
  Phone,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import api, { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate } from '../lib/formatters';

interface VisitorPassItem {
  id: number;
  pass_code: string;
  full_name: string;
  phone: string;
  email?: string;
  gender?: string;
  base_amount: number;
  gst_rate: number;
  gst_amount: number;
  total_amount: number;
  payment_method: string;
  payment_status: 'paid' | 'pending' | 'failed' | 'refunded';
  valid_on: string;
  check_in_at?: string;
  expires_at?: string;
  notes?: string;
  branch?: {
    id: number;
    name: string;
    code?: string;
  };
  attendance_log?: {
    id: number;
    check_in_at: string;
    method: string;
  };
  creator?: {
    id: number;
    name: string;
  };
}

interface StatsData {
  today_passes_count: number;
  today_revenue: number;
  today_pending: number;
  month_passes_count: number;
}

export default function VisitorPasses() {
  const { t, i18n } = useTranslation();
  const { activeBranchId, user } = useAuth();
  const branches = user?.branches || [];

  const [passes, setPasses] = useState<VisitorPassItem[]>([]);
  const [stats, setStats] = useState<StatsData>({
    today_passes_count: 0,
    today_revenue: 0,
    today_pending: 0,
    month_passes_count: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [timeframe, setTimeframe] = useState<'today' | 'this_week' | 'this_month' | 'all'>('today');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Walk-in Registration Modal
  const [walkInModalOpen, setWalkInModalOpen] = useState(false);
  const [submittingWalkIn, setSubmittingWalkIn] = useState(false);
  const [walkInForm, setWalkInForm] = useState({
    branch_id: activeBranchId || (branches[0]?.id ?? 1),
    full_name: '',
    phone: '',
    email: '',
    gender: 'male',
    emergency_contact: '',
    payment_method: 'cash',
    notes: '',
  });

  // Receipt Modal
  const [receiptPass, setReceiptPass] = useState<VisitorPassItem | null>(null);

  const fetchPasses = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = {
        timeframe,
        status: statusFilter,
      };
      if (search.trim()) params.search = search.trim();

      const res = await api.get('/visitor-passes', { params });
      setPasses(res.data.data || []);
      if (res.data.stats) {
        setStats(res.data.stats);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPasses();
  }, [timeframe, statusFilter, activeBranchId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPasses();
  };

  const handleWalkInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walkInForm.full_name.trim() || !walkInForm.phone.trim()) {
      alert('Please fill in visitor full name and mobile number.');
      return;
    }

    try {
      setSubmittingWalkIn(true);
      const res = await api.post('/visitor-passes/manual-register', walkInForm);
      setWalkInModalOpen(false);
      setWalkInForm({
        branch_id: activeBranchId || (branches[0]?.id ?? 1),
        full_name: '',
        phone: '',
        email: '',
        gender: 'male',
        emergency_contact: '',
        payment_method: 'cash',
        notes: '',
      });
      fetchPasses();
      setReceiptPass(res.data.pass);
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setSubmittingWalkIn(false);
    }
  };

  return (
    <div className="p-3 sm:p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E9ECEF] dark:border-[#2E2E33]">
        <div className="space-y-1">
          <h1 className="text-gym-title font-display font-bold text-[#171717] dark:text-[#EDEDED] flex items-center gap-2">
            <Ticket className="w-6 h-6 text-[#D92332]" />
            <span>One-Day Visitor Passes</span>
          </h1>
          <p className="text-gym-sub">
            Track QR self-purchased passes, monitor visitor attendance, and register counter walk-ins
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchPasses}
            className="btn-gym-secondary text-xs min-h-[38px] px-3.5 py-2 cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setWalkInModalOpen(true)}
            className="btn-gym-primary text-xs min-h-[38px] px-4 py-2 cursor-pointer flex items-center gap-2 shadow-md shadow-red-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>+ Register Walk-In Visitor</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Today's Paid Passes</span>
            <Ticket className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-2 font-mono">
            {stats.today_passes_count}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Checked-in & paid today</span>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Today's Revenue</span>
            <Wallet className="w-4 h-4 text-[#D92332]" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-2 font-mono">
            ₹{stats.today_revenue.toLocaleString('en-IN')}
          </div>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 block font-semibold">
            From 1-day pass entries
          </span>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Month Total Passes</span>
            <Users className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-2 font-mono">
            {stats.month_passes_count}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Calendar month walk-ins</span>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Pending Orders</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-2 font-mono">
            {stats.today_pending}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Awaiting checkout completion</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#171717] border border-slate-200 dark:border-[#2E2E33] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Timeframe Tabs */}
        <div className="flex items-center gap-1 bg-slate-200/80 dark:bg-[#202020] p-1 rounded-xl text-xs overflow-x-auto">
          {(['today', 'this_week', 'this_month', 'all'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1.5 rounded-lg font-bold transition capitalize cursor-pointer shrink-0 ${
                timeframe === tf
                  ? 'bg-white dark:bg-[#2C2C2C] text-[#D92332] dark:text-[#F02D3A] shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tf.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Status Dropdown & Search Bar */}
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030] rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="paid">Paid & Verified</option>
            <option value="pending">Pending Payment</option>
            <option value="failed">Failed / Revoked</option>
          </select>

          <form onSubmit={handleSearchSubmit} className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search visitor, phone, pass code..."
              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030] rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#D92332]"
            />
          </form>
        </div>
      </div>

      {/* Main Passes Table */}
      <div className="bg-white dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030] rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#D92332]" />
            <span>Loading visitor passes...</span>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-rose-500 text-xs">
            {error}
          </div>
        ) : passes.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <Ticket className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              No visitor passes found for this filter.
            </p>
            <p className="text-[11px] text-slate-400">
              Walk-in visitors can buy passes via the branch QR poster or counter registration.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-[#171717] text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-[#303030]">
                <tr>
                  <th className="py-3 px-4">Pass Code</th>
                  <th className="py-3 px-4">Visitor Name & Phone</th>
                  <th className="py-3 px-4">Branch</th>
                  <th className="py-3 px-4">Check-in Time</th>
                  <th className="py-3 px-4">Amount & Tax</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#282828]">
                {passes.map((pass) => (
                  <tr key={pass.id} className="hover:bg-slate-50/60 dark:hover:bg-[#232323]/50">
                    <td className="py-3 px-4 font-mono font-bold text-[#D92332] dark:text-[#F02D3A]">
                      {pass.pass_code}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 dark:text-white block">
                        {pass.full_name}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {pass.phone} {pass.gender ? `• ${pass.gender}` : ''}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                      {pass.branch?.name || 'Main Club'}
                    </td>
                    <td className="py-3 px-4">
                      {pass.check_in_at ? (
                        <>
                          <span className="font-semibold text-slate-900 dark:text-slate-200 block">
                            {new Date(pass.check_in_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {formatDate(pass.valid_on)}
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Not checked in</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 dark:text-white block font-mono">
                        ₹{pass.total_amount}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Base: ₹{pass.base_amount} + GST ₹{pass.gst_amount}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            pass.payment_status === 'paid'
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : pass.payment_status === 'pending'
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                              : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {pass.payment_status}
                        </span>
                        <span className="text-[10px] text-slate-400 capitalize">
                          ({pass.payment_method})
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setReceiptPass(pass)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#252525] hover:bg-slate-200 dark:hover:bg-[#303030] text-slate-700 dark:text-slate-300 text-[11px] font-bold cursor-pointer transition"
                      >
                        Receipt
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* MODAL 1: REGISTER WALK-IN VISITOR (COUNTER CASH / UPI)          */}
      {/* ============================================================== */}
      {walkInModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#141414] border border-slate-200 dark:border-[#303030] rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#282828]">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-red-500/10 text-[#D92332]">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Register Walk-In Visitor Pass
                  </h3>
                  <p className="text-xs text-slate-400">
                    Counter registration for guest with instant pass and attendance log
                  </p>
                </div>
              </div>
              <button
                onClick={() => setWalkInModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleWalkInSubmit} className="space-y-3.5">
              {branches.length > 1 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Select Facility Branch</label>
                  <select
                    value={walkInForm.branch_id}
                    onChange={(e) => setWalkInForm({ ...walkInForm, branch_id: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1E1E1E] border border-slate-300 dark:border-[#333] rounded-xl text-xs text-slate-900 dark:text-white"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Visitor Full Name *</label>
                  <input
                    type="text"
                    required
                    value={walkInForm.full_name}
                    onChange={(e) => setWalkInForm({ ...walkInForm, full_name: e.target.value })}
                    placeholder="e.g. Sameer Patel"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1E1E1E] border border-slate-300 dark:border-[#333] rounded-xl text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Mobile Number *</label>
                  <input
                    type="tel"
                    required
                    value={walkInForm.phone}
                    onChange={(e) => setWalkInForm({ ...walkInForm, phone: e.target.value })}
                    placeholder="e.g. 98220 99881"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1E1E1E] border border-slate-300 dark:border-[#333] rounded-xl text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={walkInForm.email}
                    onChange={(e) => setWalkInForm({ ...walkInForm, email: e.target.value })}
                    placeholder="visitor@gmail.com"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1E1E1E] border border-slate-300 dark:border-[#333] rounded-xl text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Gender</label>
                  <select
                    value={walkInForm.gender}
                    onChange={(e) => setWalkInForm({ ...walkInForm, gender: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1E1E1E] border border-slate-300 dark:border-[#333] rounded-xl text-xs text-slate-900 dark:text-white"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['cash', 'upi', 'pos_card'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setWalkInForm({ ...walkInForm, payment_method: m })}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold uppercase transition cursor-pointer ${
                        walkInForm.payment_method === m
                          ? 'bg-[#D92332] text-white border-red-500'
                          : 'bg-slate-100 dark:bg-[#1E1E1E] border-slate-200 dark:border-[#333] text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {m.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Reception Notes</label>
                <input
                  type="text"
                  value={walkInForm.notes}
                  onChange={(e) => setWalkInForm({ ...walkInForm, notes: e.target.value })}
                  placeholder="e.g. Friend of member ICF-0012"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1E1E1E] border border-slate-300 dark:border-[#333] rounded-xl text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-[#282828]">
                <button
                  type="button"
                  onClick={() => setWalkInModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-[#202020] text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingWalkIn}
                  className="px-5 py-2 rounded-xl bg-[#D92332] hover:bg-[#B91C2B] text-white text-xs font-bold transition disabled:opacity-50 cursor-pointer shadow-md"
                >
                  {submittingWalkIn ? 'Issuing Pass...' : 'Issue Pass & Check In'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: PRINTABLE VISITOR PASS RECEIPT                        */}
      {/* ============================================================== */}
      {receiptPass && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 rounded-3xl p-6 sm:p-8 w-full max-w-sm shadow-2xl space-y-4 text-center border-2 border-slate-200">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600">
                Official Gym Pass Receipt
              </span>
              <button
                onClick={() => setReceiptPass(null)}
                className="text-slate-400 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <h3 className="text-xl font-black text-slate-900">
                {receiptPass.full_name}
              </h3>
              <p className="text-xs font-mono font-bold text-[#D92332] mt-0.5">
                Pass Code: {receiptPass.pass_code}
              </p>
            </div>

            {/* QR Pass */}
            <div className="p-3 bg-white border border-slate-200 rounded-2xl inline-block shadow-sm">
              <QRCodeSVG
                value={`VISITOR:${receiptPass.pass_code}`}
                size={160}
                level="H"
                includeMargin={false}
              />
            </div>

            <div className="text-left bg-slate-50 rounded-xl p-3.5 space-y-2 text-xs border border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-500">Validity:</span>
                <span className="font-bold text-slate-800">Today ({formatDate(receiptPass.valid_on)})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Paid:</span>
                <span className="font-bold text-slate-900">₹{receiptPass.total_amount} (Incl. GST)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Method:</span>
                <span className="font-semibold text-slate-700 uppercase">{receiptPass.payment_method}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Branch:</span>
                <span className="font-semibold text-slate-700">{receiptPass.branch?.name}</span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Printer className="w-4 h-4" />
                <span>Print Pass</span>
              </button>
              <button
                onClick={() => setReceiptPass(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
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
