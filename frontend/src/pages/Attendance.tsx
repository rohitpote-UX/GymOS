import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CalendarCheck,
  Check,
  CheckCircle2,
  Clock,
  Coins,
  LogOut,
  QrCode,
  RotateCcw,
  Search,
  ShieldAlert,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import api, { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { submitWithOutbox } from '../lib/outbox';

interface MemberSummary {
  id: number;
  member_code: string;
  first_name: string;
  last_name: string;
  phone: string;
  status: string;
  photo_data?: string;
  avatar_url?: string;
  outstanding_balance?: number;
}

interface AttendanceItem {
  id: number;
  client_uuid?: string;
  check_in_at: string;
  check_out_at?: string;
  method: string;
  member: MemberSummary;
}

export default function Attendance() {
  const { activeBranchId } = useAuth();
  const [logs, setLogs] = useState<AttendanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total_check_ins: 0,
    currently_inside: 0,
    morning_check_ins: 0,
    evening_check_ins: 0,
  });

  // QR & Manual search
  const [qrInput, setQrInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MemberSummary[]>([]);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Instant Verification Modal State
  const [verificationModal, setVerificationModal] = useState<{
    open: boolean;
    member?: any;
    plan_name?: string;
    is_expired?: boolean;
    is_frozen?: boolean;
    remaining_days?: number;
    outstanding_balance?: number;
    already_inside?: boolean;
    action?: string;
    message?: string;
  } | null>(null);

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      const [logsRes, statsRes] = await Promise.all([
        api.get<{ data: AttendanceItem[] }>('/attendance'),
        api.get<any>('/attendance/today-stats'),
      ]);
      setLogs(logsRes.data.data || []);
      setStats(statsRes.data || { total_check_ins: 0, currently_inside: 0 });
    } catch {
      // offline or error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [activeBranchId]);

  // Search members
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.get<{ data: MemberSummary[] }>(`/members?search=${encodeURIComponent(searchQuery)}`);
        setSearchResults(res.data.data || []);
      } catch {
        // ignore
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleQrCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrInput.trim()) return;

    setCheckInLoading(true);
    setToastMessage(null);
    try {
      const res = await api.post('/attendance/qr-check-in', {
        qr_data: qrInput.trim(),
        branch_id: activeBranchId,
      });

      setVerificationModal({
        open: true,
        member: res.data.member || res.data.log?.member,
        plan_name: res.data.plan_name,
        is_expired: res.data.is_expired,
        is_frozen: res.data.is_frozen,
        remaining_days: res.data.remaining_days,
        outstanding_balance: res.data.outstanding_balance,
        already_inside: res.data.already_inside,
        action: res.data.action,
        message: res.data.message,
      });

      setQrInput('');
      fetchAttendance();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Member not found or check-in failed.');
    } finally {
      setCheckInLoading(false);
    }
  };

  const handleManualCheckIn = async (member: MemberSummary) => {
    setCheckInLoading(true);
    setToastMessage(null);
    try {
      const res = await api.post('/attendance/qr-check-in', {
        qr_data: member.member_code,
        branch_id: activeBranchId,
      });

      setVerificationModal({
        open: true,
        member: res.data.member || res.data.log?.member || member,
        plan_name: res.data.plan_name,
        is_expired: res.data.is_expired,
        is_frozen: res.data.is_frozen,
        remaining_days: res.data.remaining_days,
        outstanding_balance: res.data.outstanding_balance,
        already_inside: res.data.already_inside,
        action: res.data.action,
        message: res.data.message,
      });

      setSearchQuery('');
      setSearchResults([]);
      fetchAttendance();
    } catch (err: any) {
      setToastMessage(errorMessage(err));
    } finally {
      setCheckInLoading(false);
    }
  };

  const handleCheckOut = async (id: number) => {
    try {
      await api.post(`/attendance/${id}/check-out`);
      setToastMessage('Check-out recorded successfully.');
      fetchAttendance();
    } catch (err) {
      setToastMessage(errorMessage(err));
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <CalendarCheck className="w-6 h-6 text-emerald-400" />
            <span>Attendance & Floor Access Control</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            QR code scanner, member validity alerts, duplicate check-in prevention, and live occupancy
          </p>
        </div>

        {/* Live Counter Badges */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-[#0f172a] border border-slate-800 px-4 py-2 rounded-xl flex items-center gap-3">
            <Activity className="w-5 h-5 text-sky-400 animate-pulse" />
            <div>
              <span className="text-xs text-slate-400 uppercase tracking-wider block text-[10px]">On Floor</span>
              <span className="text-lg font-black text-white">{stats.currently_inside} Members</span>
            </div>
          </div>
          <div className="bg-[#0f172a] border border-slate-800 px-4 py-2 rounded-xl flex items-center gap-3">
            <Users className="w-5 h-5 text-emerald-400" />
            <div>
              <span className="text-xs text-slate-400 uppercase tracking-wider block text-[10px]">Today's Check-ins</span>
              <span className="text-lg font-black text-white">{stats.total_check_ins} Total</span>
            </div>
          </div>
        </div>
      </div>

      {toastMessage && (
        <div className="p-3 bg-slate-800 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center justify-between">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
        </div>
      )}

      {/* QR Scanner & Quick Search Console */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Box 1: QR Pass Scanner Simulator */}
        <div className="bg-gradient-to-br from-[#0f172a] to-[#131b2e] border border-emerald-500/30 p-5 rounded-2xl shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <QrCode className="w-5 h-5 text-emerald-400" />
              <span>QR Code Scanner / ID Check-in</span>
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              FAST PASS
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Scan member QR pass with camera or type member code (e.g. <span className="font-mono text-emerald-400 font-bold">MEM-0001</span>, <span className="font-mono text-emerald-400 font-bold">ICF-0001</span>).
          </p>

          <form onSubmit={handleQrCheckIn} className="flex gap-2">
            <input
              type="text"
              autoFocus
              value={qrInput}
              onChange={(e) => setQrInput(e.target.value)}
              placeholder="Scan QR payload or type MEM-xxxx..."
              className="flex-1 bg-[#090d16] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={checkInLoading || !qrInput.trim()}
              className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs cursor-pointer transition-colors shadow-lg shadow-emerald-500/20"
            >
              {checkInLoading ? 'Checking...' : 'Check-In'}
            </button>
          </form>
        </div>

        {/* Box 2: Name / Phone Search Entry */}
        <div className="bg-[#0f172a] border border-slate-800 p-5 rounded-2xl space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-sky-400" />
            <span>Search Member by Name or Phone</span>
          </h3>
          <p className="text-xs text-slate-400">
            Front-desk manual check-in for members without their phone or QR card.
          </p>

          <div className="relative">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type name (e.g. Aarav) or phone..."
                className="w-full bg-[#131b2e] border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Dropdown */}
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-[#131b2e] border border-slate-700 rounded-xl shadow-2xl z-30 max-h-60 overflow-y-auto divide-y divide-slate-800">
                {searchResults.map((m) => (
                  <div
                    key={m.id}
                    className="p-3 flex items-center justify-between hover:bg-slate-800/80 transition-colors"
                  >
                    <div>
                      <div className="font-semibold text-xs text-white">
                        {m.first_name} {m.last_name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {m.member_code} • {m.phone}
                      </div>
                    </div>
                    <button
                      onClick={() => handleManualCheckIn(m)}
                      disabled={checkInLoading}
                      className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs cursor-pointer transition-colors"
                    >
                      Check-In
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Instant Verification Modal */}
      {verificationModal?.open && verificationModal.member && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center font-bold text-white text-lg overflow-hidden shrink-0">
                  {verificationModal.member.photo_data ? (
                    <img src={verificationModal.member.photo_data} alt="" className="w-full h-full object-cover" />
                  ) : (
                    `${verificationModal.member.first_name?.[0] || 'M'}`
                  )}
                </div>
                <div>
                  <h3 className="font-black text-white text-lg">
                    {verificationModal.member.first_name} {verificationModal.member.last_name}
                  </h3>
                  <div className="text-xs text-slate-400 font-mono">
                    {verificationModal.member.member_code} • {verificationModal.member.phone}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setVerificationModal(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Status Alerts */}
            {verificationModal.is_expired && (
              <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-3.5 rounded-xl text-xs flex items-center gap-2.5">
                <ShieldAlert className="w-5 h-5 shrink-0" />
                <div>
                  <div className="font-bold">MEMBERSHIP EXPIRED OR INACTIVE</div>
                  <div className="text-[11px] opacity-90 mt-0.5">Please instruct member to renew at front desk.</div>
                </div>
              </div>
            )}

            {verificationModal.is_frozen && (
              <div className="bg-blue-500/10 border border-blue-500/30 text-blue-400 p-3.5 rounded-xl text-xs flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <div>
                  <div className="font-bold">MEMBERSHIP CURRENTLY FROZEN</div>
                  <div className="text-[11px] opacity-90 mt-0.5">Member must unfreeze plan before floor workouts.</div>
                </div>
              </div>
            )}

            {Number(verificationModal.outstanding_balance) > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 p-3.5 rounded-xl text-xs flex items-center gap-2.5">
                <Coins className="w-5 h-5 shrink-0" />
                <div>
                  <div className="font-bold">PENDING DUES: ₹{Number(verificationModal.outstanding_balance).toLocaleString('en-IN')}</div>
                  <div className="text-[11px] opacity-90 mt-0.5">Payment balance due on member ledger account.</div>
                </div>
              </div>
            )}

            {/* Check-in Confirmation Banner */}
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400">
              <div className="font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>{verificationModal.message || 'Check-in Recorded'}</span>
              </div>
              <div className="text-[11px] text-slate-300 mt-1">
                Active Plan: <strong className="text-white">{verificationModal.plan_name || 'Regular'}</strong>
                {verificationModal.remaining_days !== undefined && (
                  <span className="ml-2">({verificationModal.remaining_days} days remaining)</span>
                )}
              </div>
            </div>

            <button
              onClick={() => setVerificationModal(null)}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer transition-colors"
            >
              Done / Next Member
            </button>
          </div>
        </div>
      )}

      {/* Attendance Activity Table */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-white text-xs uppercase tracking-wider">
            Today's Check-In Activity Log
          </h3>
          <button
            onClick={fetchAttendance}
            className="text-slate-400 hover:text-white text-xs flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>

        {logs.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            No check-in records recorded today. Use the search or QR scanner above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/60 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Member Name</th>
                  <th className="py-3 px-4">Member Code</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Check-in Time</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Check-out Time</th>
                  <th className="py-3 px-4 text-right">Floor Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {logs.map((item) => {
                  const isInside = !item.check_out_at;
                  return (
                    <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 font-semibold text-white">
                        {item.member?.first_name} {item.member?.last_name}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400">
                        {item.member?.member_code}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">
                        {item.member?.phone}
                      </td>
                      <td className="py-3 px-4 font-mono text-emerald-400">
                        {item.check_in_at}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md text-[10px] bg-slate-800 text-slate-300 capitalize font-medium">
                          {item.method.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400">
                        {item.check_out_at || '—'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isInside ? (
                          <button
                            onClick={() => handleCheckOut(item.id)}
                            className="px-2.5 py-1 bg-sky-500/20 hover:bg-sky-500 text-sky-400 hover:text-slate-950 font-bold rounded-lg text-[10px] cursor-pointer transition-colors inline-flex items-center gap-1"
                          >
                            <LogOut className="w-3 h-3" />
                            Check Out
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-medium">Completed</span>
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
    </div>
  );
}
