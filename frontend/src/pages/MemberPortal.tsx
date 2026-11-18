import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Dumbbell,
  Flame,
  QrCode,
  Receipt,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  User,
  X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import api, { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { formatCurrency, formatDate, formatNumber } from '../lib/formatters';

interface MemberProfile {
  id: number;
  member_code: string;
  first_name: string;
  last_name: string;
  phone: string;
  email?: string;
  status: string;
  photo_url?: string;
  outstanding_balance: number;
  branch?: {
    id: number;
    name: string;
  };
  assigned_trainer?: {
    id: number;
    name: string;
    specialization?: string;
  };
  active_membership?: {
    id: number;
    start_date: string;
    end_date: string;
    status: string;
    plan?: {
      id: number;
      name: string;
      duration_days: number;
    };
  };
}

interface AttendanceStats {
  streak_days: number;
  total_visits_this_month: number;
  last_check_in?: string;
  recent_logs: Array<{
    id: number;
    check_in_at: string;
    check_out_at?: string;
    branch_name: string;
  }>;
}

interface PaymentRecord {
  id: number;
  receipt_number: string;
  amount: number;
  payment_method: string;
  payment_date: string;
  status: string;
}

interface WorkoutPlan {
  id: number;
  title: string;
  goal: string;
  difficulty: string;
  days_per_week: number;
  exercises: Array<{
    day: string;
    items: Array<{
      name: string;
      sets: number;
      reps: string;
    }>;
  }>;
  coach_notes?: string;
}

interface PtSessionInfo {
  total_sessions: number;
  completed_sessions: number;
  remaining_sessions: number;
  coach_name?: string;
}

export default function MemberPortal() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [attendance, setAttendance] = useState<AttendanceStats | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [workout, setWorkout] = useState<WorkoutPlan | null>(null);
  const [ptInfo, setPtInfo] = useState<PtSessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Renewal Modal
  const [renewalModalOpen, setRenewalModalOpen] = useState(false);
  const [renewalPlanId, setRenewalPlanId] = useState('');
  const [renewalNotes, setRenewalNotes] = useState('');
  const [plans, setPlans] = useState<Array<{ id: number; name: string; price: number }>>([]);
  const [submittingRenewal, setSubmittingRenewal] = useState(false);
  const [renewalSuccess, setRenewalSuccess] = useState<string | null>(null);

  // Show large QR modal
  const [qrModalOpen, setQrModalOpen] = useState(false);

  const fetchPortalData = async () => {
    try {
      setLoading(true);
      const [profileRes, attRes, payRes, workRes, ptRes] = await Promise.all([
        api.get('/member-portal/profile'),
        api.get('/member-portal/attendance').catch(() => ({ data: { streak_days: 0, total_visits_this_month: 0, recent_logs: [] } })),
        api.get('/member-portal/payments').catch(() => ({ data: { payments: [] } })),
        api.get('/member-portal/workouts').catch(() => ({ data: { workout_plan: null } })),
        api.get('/member-portal/pt-sessions').catch(() => ({ data: { pt_sessions: { total_sessions: 0, completed_sessions: 0, remaining_sessions: 0 } } })),
      ]);

      setProfile(profileRes.data.member || profileRes.data);
      setAttendance(attRes.data);
      setPayments(payRes.data.payments || []);
      setWorkout(workRes.data.workout_plan || null);
      setPtInfo(ptRes.data.pt_sessions || null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const fetchPlans = async () => {
    try {
      const res = await api.get('/membership-plans');
      setPlans(res.data.plans || res.data.data || []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchPortalData();
    fetchPlans();
  }, []);

  const handleRenewalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmittingRenewal(true);
      await api.post('/member-portal/renew-request', {
        plan_id: renewalPlanId ? Number(renewalPlanId) : null,
        notes: renewalNotes,
      });
      setRenewalModalOpen(false);
      setRenewalNotes('');
      setRenewalSuccess('Renewal request submitted! Reception desk has been notified.');
      setTimeout(() => setRenewalSuccess(null), 5000);
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setSubmittingRenewal(false);
    }
  };

  if (loading && !profile) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh] text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-medium">Loading member portal...</p>
        </div>
      </div>
    );
  }

  const isExpired = profile?.active_membership
    ? new Date(profile.active_membership.end_date) < new Date()
    : true;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <span>{t('portal.title', 'Member Digital Pass')}</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {t('portal.subtitle', 'Digital gym ID, attendance history, active subscription and renewals')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <LanguageSwitcher variant="dropdown" />
          <button
            onClick={fetchPortalData}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 border border-slate-700 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {renewalSuccess && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{renewalSuccess}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Digital Membership Pass Card (Front) */}
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-slate-900 via-slate-900 to-emerald-950 border border-slate-700/80 p-6 md:p-8 shadow-2xl text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black tracking-widest uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {user?.gym?.name || 'GYM BUSINESS OS'}
              </span>
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                  !isExpired
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-rose-500 text-white'
                }`}
              >
                {!isExpired ? 'Active Member' : 'Expired'}
              </span>
            </div>

            <div>
              <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                {profile?.first_name} {profile?.last_name}
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                ID: {profile?.member_code} • Branch: {profile?.branch?.name || 'Main Club'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-[10px] uppercase text-slate-400 block font-semibold">Active Plan</span>
                <span className="font-bold text-white text-sm">
                  {profile?.active_membership?.plan?.name || 'No Active Plan'}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-400 block font-semibold">Valid Until</span>
                <span className="font-bold text-emerald-400 text-sm font-mono">
                  {profile?.active_membership?.end_date || 'N/A'}
                </span>
              </div>
            </div>

            {profile?.assigned_trainer && (
              <div className="text-xs text-slate-300 flex items-center gap-1.5 pt-1">
                <User className="w-3.5 h-3.5 text-emerald-400" />
                <span>Coach: <strong>{profile.assigned_trainer.name}</strong></span>
              </div>
            )}
          </div>

          {/* QR Code Pass for Turnstile */}
          <div className="flex flex-col items-center gap-2 bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10 shrink-0 self-start md:self-auto">
            <div
              onClick={() => setQrModalOpen(true)}
              className="bg-white p-2.5 rounded-xl cursor-pointer hover:scale-105 transition-transform"
            >
              <QRCodeSVG
                value={profile?.member_code || 'GYM-MEMBER'}
                size={110}
                level="H"
                includeMargin={false}
              />
            </div>
            <span className="text-[10px] text-slate-400 font-mono tracking-wider">TAP TO ENLARGE PASS</span>
          </div>
        </div>

        {/* Action Button inside Card */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between flex-wrap gap-3">
          <div className="text-xs text-slate-400">
            {profile?.outstanding_balance && profile.outstanding_balance > 0 ? (
              <span className="text-rose-400 font-semibold">
                Outstanding Balance: ₹{profile.outstanding_balance}
              </span>
            ) : (
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Dues Cleared
              </span>
            )}
          </div>

          <button
            onClick={() => setRenewalModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors shadow-lg shadow-emerald-950/40 cursor-pointer"
          >
            Request Membership Renewal
          </button>
        </div>
      </div>

      {/* Attendance & Streak Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#0f172a] border border-slate-800 p-4 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-400">
            <span className="text-[10px] uppercase font-bold tracking-wider">Workout Streak</span>
            <Flame className="w-4 h-4" />
          </div>
          <div className="text-3xl font-black text-white mt-2">
            {attendance?.streak_days || 0} <span className="text-xs text-slate-400 font-normal">Days</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1">Consistency score</span>
        </div>

        <div className="bg-[#0f172a] border border-slate-800 p-4 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-400">
            <span className="text-[10px] uppercase font-bold tracking-wider">Month Check-ins</span>
            <Activity className="w-4 h-4" />
          </div>
          <div className="text-3xl font-black text-white mt-2">
            {attendance?.total_visits_this_month || 0} <span className="text-xs text-slate-400 font-normal">Visits</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1">This calendar month</span>
        </div>

        <div className="bg-[#0f172a] border border-slate-800 p-4 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-sky-400">
            <span className="text-[10px] uppercase font-bold tracking-wider">PT Sessions</span>
            <Dumbbell className="w-4 h-4" />
          </div>
          <div className="text-3xl font-black text-white mt-2">
            {ptInfo?.completed_sessions || 0} / {ptInfo?.total_sessions || 0}
          </div>
          <span className="text-[10px] text-slate-400 mt-1">
            {ptInfo?.remaining_sessions || 0} sessions remaining
          </span>
        </div>

        <div className="bg-[#0f172a] border border-slate-800 p-4 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-indigo-400">
            <span className="text-[10px] uppercase font-bold tracking-wider">Last Check-in</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-sm font-bold text-white mt-2 truncate">
            {attendance?.last_check_in || 'No check-in yet'}
          </div>
          <span className="text-[10px] text-slate-400 mt-1">Turnstile verified</span>
        </div>
      </div>

      {/* Assigned Workout Plan Section */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Dumbbell className="w-4 h-4 text-emerald-400" />
              <span>Assigned Workout Routine</span>
            </h3>
            <p className="text-[11px] text-slate-400">Custom tailored plan by your dedicated trainer</p>
          </div>

          {workout && (
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20 capitalize">
              {workout.difficulty} • {workout.goal.replace('_', ' ')}
            </span>
          )}
        </div>

        {workout ? (
          <div className="space-y-4">
            <div className="text-sm font-bold text-white">{workout.title}</div>
            {workout.coach_notes && (
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 italic">
                Coach Notes: "{workout.coach_notes}"
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(workout.exercises || []).map((exDay, idx) => (
                <div key={idx} className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-2">
                  <div className="text-xs font-bold text-emerald-400">{exDay.day}</div>
                  <div className="space-y-1.5">
                    {(exDay.items || []).map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-xs text-slate-200">
                        <span>{item.name}</span>
                        <span className="font-mono text-slate-400 text-[11px]">
                          {item.sets} sets × {item.reps} reps
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-slate-400 text-xs">
            No active workout routine assigned. Ask your assigned trainer to set up your plan.
          </div>
        )}
      </div>

      {/* Payment History Table */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-400" />
              <span>Payment History & Invoices</span>
            </h3>
            <p className="text-[11px] text-slate-400">All registered membership and supplement transactions</p>
          </div>
        </div>

        {payments.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-xs">No payment records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Receipt No</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Payment Mode</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/30">
                    <td className="py-2.5 px-3 font-mono font-semibold text-white">{p.receipt_number}</td>
                    <td className="py-2.5 px-3 text-slate-400">{p.payment_date}</td>
                    <td className="py-2.5 px-3 uppercase text-slate-400 font-mono text-[11px]">
                      {p.payment_method}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-white">₹{Number(p.amount).toLocaleString('en-IN')}</td>
                    <td className="py-2.5 px-3 text-right">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 capitalize">
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Enlarged QR Modal */}
      {qrModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-8 max-w-sm w-full text-center space-y-4 shadow-2xl">
            <div className="flex justify-end">
              <button onClick={() => setQrModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <h3 className="text-base font-bold text-white">Scan at Gym Entrance</h3>
            <div className="bg-white p-4 rounded-2xl inline-block shadow-lg">
              <QRCodeSVG
                value={profile?.member_code || 'GYM-MEMBER'}
                size={220}
                level="H"
                includeMargin={false}
              />
            </div>
            <p className="font-mono text-sm text-emerald-400 font-bold">{profile?.member_code}</p>
            <p className="text-xs text-slate-400">Hold near the turnstile scanner for automatic entry log.</p>
          </div>
        </div>
      )}

      {/* Renewal Request Modal */}
      {renewalModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Request Membership Renewal</h3>
              <button
                onClick={() => setRenewalModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRenewalSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Select Preferred Package</label>
                <select
                  value={renewalPlanId}
                  onChange={(e) => setRenewalPlanId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                >
                  <option value="">Keep Same Package / Unspecified</option>
                  {plans.map((pl) => (
                    <option key={pl.id} value={pl.id}>
                      {pl.name} (₹{pl.price})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Notes / Preferences for Reception</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Please send payment link for UPI."
                  value={renewalNotes}
                  onChange={(e) => setRenewalNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRenewalModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRenewal}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {submittingRenewal ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
