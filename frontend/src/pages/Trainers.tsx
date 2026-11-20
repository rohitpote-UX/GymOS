import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  Dumbbell,
  FileText,
  Plus,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface Trainer {
  id: number;
  name: string;
  email: string;
  phone: string;
  specialization?: string;
  bio?: string;
  base_salary: number | string;
  commission_percent: number | string;
  pt_session_rate: number | string;
  active_clients_count?: number;
  completed_sessions_this_month?: number;
}

interface PtSession {
  id: number;
  session_date: string;
  start_time?: string;
  duration_minutes: number;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  trainer_notes?: string;
  client_feedback?: string;
  completed_at?: string;
  member?: { id: number; member_code: string; first_name: string; last_name: string; phone: string };
  trainer?: { id: number; name: string };
}

interface StaffLeave {
  id: number;
  leave_type: string;
  start_date: string;
  end_date: string;
  days_count: number;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  user?: { id: number; name: string; role: string };
}

interface PayoutReportRow {
  trainer_id: number;
  trainer_name: string;
  base_salary: number;
  completed_sessions_count: number;
  session_rate: number;
  pt_session_earnings: number;
  total_monthly_payout: number;
}

export default function Trainers() {
  const { t } = useTranslation();
  const { user, activeBranchId } = useAuth();
  const [activeTab, setActiveTab] = useState<'roster' | 'sessions' | 'leaves' | 'payouts'>('roster');

  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [sessions, setSessions] = useState<PtSession[]>([]);
  const [leaves, setLeaves] = useState<StaffLeave[]>([]);
  const [payouts, setPayouts] = useState<PayoutReportRow[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Schedule Session Modal
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    member_id: '',
    trainer_id: '',
    session_date: new Date().toISOString().split('T')[0],
    start_time: '18:00',
    duration_minutes: '60',
    notes: '',
  });

  // Complete Session Modal
  const [completeModalSession, setCompleteModalSession] = useState<PtSession | null>(null);
  const [completeForm, setCompleteForm] = useState({
    trainer_notes: '',
    client_feedback: '',
  });

  // Request Leave Modal
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    leave_type: 'casual',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    reason: '',
  });

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isOwnerOrManager = user?.role === 'gym_owner' || user?.role === 'branch_manager';

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = activeBranchId ? { branch_id: activeBranchId } : {};

      const [resTrainers, resSessions, resLeaves, resPayouts, resMembers] = await Promise.all([
        api.get('/trainers', { params }),
        api.get('/pt-sessions', { params }),
        api.get('/staff-leaves', { params }),
        api.get('/trainers/performance-report', { params }),
        api.get('/members', { params: { per_page: 100 } }),
      ]);

      setTrainers(resTrainers.data || []);
      setSessions(resSessions.data.data || resSessions.data || []);
      setLeaves(resLeaves.data || []);
      setPayouts(resPayouts.data.trainers || []);
      setMembers(resMembers.data.data || resMembers.data || []);
    } catch (err: any) {
      console.error('Failed to load trainer data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeBranchId]);

  const handleScheduleSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post('/pt-sessions', {
        ...scheduleForm,
        member_id: parseInt(scheduleForm.member_id, 10),
        trainer_id: parseInt(scheduleForm.trainer_id, 10),
        duration_minutes: parseInt(scheduleForm.duration_minutes, 10) || 60,
        branch_id: activeBranchId,
      });

      setSuccess('Personal training session scheduled successfully.');
      setScheduleModalOpen(false);
      setScheduleForm({
        member_id: '',
        trainer_id: '',
        session_date: new Date().toISOString().split('T')[0],
        start_time: '18:00',
        duration_minutes: '60',
        notes: '',
      });
      fetchData();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to schedule session.');
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completeModalSession) return;
    setSaving(true);
    setError(null);
    try {
      await api.post(`/pt-sessions/${completeModalSession.id}/complete`, completeForm);
      setSuccess('Session marked as completed. Completed count updated.');
      setCompleteModalSession(null);
      fetchData();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to complete session.');
    } finally {
      setSaving(false);
    }
  };

  const handleRequestLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post('/staff-leaves', {
        ...leaveForm,
        branch_id: activeBranchId,
      });
      setSuccess('Leave request submitted successfully.');
      setLeaveModalOpen(false);
      fetchData();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit leave.');
    } finally {
      setSaving(false);
    }
  };

  const handleReviewLeave = async (leaveId: number, status: 'approved' | 'rejected') => {
    try {
      await api.post(`/staff-leaves/${leaveId}/review`, { status });
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to review leave.');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Dumbbell className="w-6 h-6 text-emerald-400" />
            {t('trainers.title', 'Staff & Personal Trainers')}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {t('trainers.subtitle', 'Manage fitness coaches, 1-on-1 PT sessions, compensation payouts, and staff leaves.')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setError(null);
              setScheduleModalOpen(true);
            }}
            className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold px-4 py-2 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('trainers.log_session', 'Schedule PT Session')}
          </button>
          <button
            onClick={() => {
              setError(null);
              setLeaveModalOpen(true);
            }}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5" />
            {t('common.details', 'Request Leave')}
          </button>
        </div>
      </div>

      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-6 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('roster')}
          className={`pb-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'roster'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          Trainer Profiles & Roster ({trainers.length})
        </button>
        <button
          onClick={() => setActiveTab('sessions')}
          className={`pb-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'sessions'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          PT Sessions Calendar ({sessions.length})
        </button>
        <button
          onClick={() => setActiveTab('payouts')}
          className={`pb-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'payouts'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Wallet className="w-4 h-4" />
          Performance & Salary Payouts
        </button>
        <button
          onClick={() => setActiveTab('leaves')}
          className={`pb-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'leaves'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Staff Leaves ({leaves.length})
        </button>
      </div>

      {/* Tab 1: Trainer Roster Cards */}
      {activeTab === 'roster' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trainers.map((t) => (
            <div
              key={t.id}
              className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm space-y-4 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center font-bold text-white text-base">
                    {t.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">{t.name}</h3>
                    <p className="text-[11px] text-emerald-400 font-medium">{t.specialization || 'Fitness Coach'}</p>
                    <p className="text-[10px] text-slate-500 font-mono">{t.phone}</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  TRAINER
                </span>
              </div>

              {t.bio && <p className="text-xs text-slate-400 italic line-clamp-2">"{t.bio}"</p>}

              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-800/80 text-xs">
                <div className="bg-[#131b2e] p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Base Salary</span>
                  <span className="font-bold text-white mt-0.5 block font-mono">
                    ₹{Number(t.base_salary || 0).toLocaleString('en-IN')}/mo
                  </span>
                </div>
                <div className="bg-[#131b2e] p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Per Session Rate</span>
                  <span className="font-bold text-emerald-400 mt-0.5 block font-mono">
                    ₹{Number(t.pt_session_rate || 0).toLocaleString('en-IN')}/sess
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center text-xs text-slate-400 pt-1">
                <span>Active Clients: <strong className="text-white">{t.active_clients_count || 0}</strong></span>
                <span>Sessions (MTD): <strong className="text-emerald-400">{t.completed_sessions_this_month || 0}</strong></span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 2: PT Sessions */}
      {activeTab === 'sessions' && (
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm">
          {sessions.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">
              No personal training sessions scheduled. Click "Schedule PT Session" above.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/60 font-medium">
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Member</th>
                    <th className="py-3 px-4">Trainer</th>
                    <th className="py-3 px-4">Duration</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Workout Notes</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {sessions.map((sess) => {
                    const isCompleted = sess.status === 'completed';
                    return (
                      <tr key={sess.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 text-white font-mono">
                          {sess.session_date}
                          {sess.start_time && <span className="text-slate-400 ml-1.5">{sess.start_time}</span>}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-white">
                            {sess.member ? `${sess.member.first_name} ${sess.member.last_name}` : 'Member'}
                          </div>
                          {sess.member?.member_code && (
                            <span className="text-[10px] text-slate-500 font-mono">{sess.member.member_code}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-300 font-medium">
                          {sess.trainer?.name || 'Coach'}
                        </td>
                        <td className="py-3 px-4 text-slate-400">
                          {sess.duration_minutes} mins
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              isCompleted
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                            }`}
                          >
                            {sess.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400 max-w-xs truncate">
                          {sess.trainer_notes || '—'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {!isCompleted && (
                            <button
                              onClick={() => {
                                setError(null);
                                setCompleteModalSession(sess);
                              }}
                              className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 font-bold rounded-lg transition-colors cursor-pointer text-[10px]"
                            >
                              Mark Completed
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Performance & Salary Payouts Report */}
      {activeTab === 'payouts' && (
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm">
          <div className="p-4 border-b border-slate-800">
            <h3 className="font-bold text-white text-xs uppercase tracking-wider">
              Trainer Compensation & Payout Audit (Month-To-Date)
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Automated server-side formula: Fixed Base Salary + (Completed PT Sessions × Per-Session Payout Rate)
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/60 font-medium">
                  <th className="py-3 px-4">Trainer Name</th>
                  <th className="py-3 px-4">Base Fixed Salary</th>
                  <th className="py-3 px-4">Completed Sessions</th>
                  <th className="py-3 px-4">Rate / Session</th>
                  <th className="py-3 px-4">PT Session Earnings</th>
                  <th className="py-3 px-4 text-right">Total Net Payout</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {payouts.map((row) => (
                  <tr key={row.trainer_id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-bold text-white">{row.trainer_name}</td>
                    <td className="py-3 px-4 text-slate-300 font-mono">₹{Number(row.base_salary).toLocaleString('en-IN')}</td>
                    <td className="py-3 px-4 text-emerald-400 font-bold">{row.completed_sessions_count} sessions</td>
                    <td className="py-3 px-4 text-slate-400 font-mono">₹{Number(row.session_rate).toLocaleString('en-IN')}</td>
                    <td className="py-3 px-4 text-emerald-400 font-mono font-bold">₹{Number(row.pt_session_earnings).toLocaleString('en-IN')}</td>
                    <td className="py-3 px-4 text-right font-mono font-black text-white text-sm">
                      ₹{Number(row.total_monthly_payout).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Staff Leaves */}
      {activeTab === 'leaves' && (
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm">
          {leaves.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">
              No leave records found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/60 font-medium">
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-4">Leave Type</th>
                    <th className="py-3 px-4">Dates</th>
                    <th className="py-3 px-4">Days</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Status</th>
                    {isOwnerOrManager && <th className="py-3 px-4 text-right">Review Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {leaves.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 font-semibold text-white">{l.user?.name || 'Staff'}</td>
                      <td className="py-3 px-4 capitalize text-slate-300">{l.leave_type}</td>
                      <td className="py-3 px-4 font-mono text-slate-400">{l.start_date} to {l.end_date}</td>
                      <td className="py-3 px-4 font-bold text-white">{l.days_count} days</td>
                      <td className="py-3 px-4 text-slate-400">{l.reason || '—'}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            l.status === 'approved'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : l.status === 'rejected'
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          }`}
                        >
                          {l.status.toUpperCase()}
                        </span>
                      </td>
                      {isOwnerOrManager && (
                        <td className="py-3 px-4 text-right">
                          {l.status === 'pending' && (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleReviewLeave(l.id, 'approved')}
                                className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 font-bold rounded-lg transition-colors cursor-pointer text-[10px]"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleReviewLeave(l.id, 'rejected')}
                                className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500 text-rose-400 hover:text-white font-bold rounded-lg transition-colors cursor-pointer text-[10px]"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Schedule PT Session Modal */}
      {scheduleModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Dumbbell className="w-5 h-5 text-emerald-400" />
                Schedule Personal Training Session
              </h2>
              <button onClick={() => setScheduleModalOpen(false)} className="text-slate-400 hover:text-white text-xs cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleScheduleSession} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Select Member *</label>
                <select
                  required
                  value={scheduleForm.member_id}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, member_id: e.target.value })}
                  className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Choose member...</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.first_name} {m.last_name} ({m.member_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Select Trainer *</label>
                <select
                  required
                  value={scheduleForm.trainer_id}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, trainer_id: e.target.value })}
                  className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Choose trainer...</option>
                  {trainers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.specialization || 'Trainer'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Session Date *</label>
                  <input
                    type="date"
                    required
                    value={scheduleForm.session_date}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, session_date: e.target.value })}
                    className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Start Time</label>
                  <input
                    type="time"
                    value={scheduleForm.start_time}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, start_time: e.target.value })}
                    className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Workout Focus / Routine Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Chest hypertrophy and rotator cuff warm-up..."
                  value={scheduleForm.notes}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, notes: e.target.value })}
                  className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button type="button" onClick={() => setScheduleModalOpen(false)} className="px-4 py-2 rounded-xl text-slate-400 hover:text-white font-medium cursor-pointer">Cancel</button>
                <button type="submit" disabled={saving} className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-bold px-5 py-2 rounded-xl cursor-pointer">
                  {saving ? 'Scheduling...' : 'Confirm Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete Session Modal */}
      {completeModalSession && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                Record Session Completion
              </h2>
              <button onClick={() => setCompleteModalSession(null)} className="text-slate-400 hover:text-white text-xs cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleCompleteSession} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Trainer Feedback & PR Achieved</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Completed 4 sets of squat @ 100kg, great form."
                  value={completeForm.trainer_notes}
                  onChange={(e) => setCompleteForm({ ...completeForm, trainer_notes: e.target.value })}
                  className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Client Feedback (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. High intensity, requested quad recovery stretch."
                  value={completeForm.client_feedback}
                  onChange={(e) => setCompleteForm({ ...completeForm, client_feedback: e.target.value })}
                  className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button type="button" onClick={() => setCompleteModalSession(null)} className="px-4 py-2 rounded-xl text-slate-400 hover:text-white font-medium cursor-pointer">Cancel</button>
                <button type="submit" disabled={saving} className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-bold px-5 py-2 rounded-xl cursor-pointer">
                  {saving ? 'Completing...' : 'Mark Completed & Log Payout'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Request Leave Modal */}
      {leaveModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-400" />
                Staff Leave Request
              </h2>
              <button onClick={() => setLeaveModalOpen(false)} className="text-slate-400 hover:text-white text-xs cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleRequestLeave} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Leave Type *</label>
                <select
                  value={leaveForm.leave_type}
                  onChange={(e) => setLeaveForm({ ...leaveForm, leave_type: e.target.value })}
                  className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="casual">Casual Leave</option>
                  <option value="sick">Sick Leave</option>
                  <option value="annual">Annual / Vacation</option>
                  <option value="unpaid">Unpaid Leave</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={leaveForm.start_date}
                    onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })}
                    className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">End Date *</label>
                  <input
                    type="date"
                    required
                    value={leaveForm.end_date}
                    onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
                    className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Reason for Leave</label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Family function, exam preparation, unwell..."
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button type="button" onClick={() => setLeaveModalOpen(false)} className="px-4 py-2 rounded-xl text-slate-400 hover:text-white font-medium cursor-pointer">Cancel</button>
                <button type="submit" disabled={saving} className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold px-5 py-2 rounded-xl cursor-pointer">
                  {saving ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
