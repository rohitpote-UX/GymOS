import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CalendarCheck,
  Check,
  CheckCircle2,
  Clock,
  Coins,
  Download,
  Dumbbell,
  ExternalLink,
  Eye,
  LogOut,
  MapPin,
  Maximize2,
  Navigation,
  Phone,
  Power,
  Printer,
  QrCode,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Smartphone,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import api, { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { submitWithOutbox } from '../lib/outbox';
import { formatDate, formatDateTime, formatNumber } from '../lib/formatters';

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
  latitude?: number;
  longitude?: number;
  member: MemberSummary;
}

interface GymQrItem {
  id: number;
  gym_id: number;
  branch_id: number;
  token: string;
  code: string;
  name: string;
  is_active: boolean;
  require_location: boolean;
  latitude?: number;
  longitude?: number;
  radius_meters: number;
  require_staff_confirmation: boolean;
  scan_count: number;
  last_scanned_at?: string;
  created_at: string;
  branch?: {
    id: number;
    name: string;
    code?: string;
    address?: string;
    city?: string;
    phone?: string;
  };
}

export default function Attendance() {
  const { t, i18n } = useTranslation();
  const { activeBranchId, user } = useAuth();

  // Tab State: 'daily' | 'self_qr'
  const [activeTab, setActiveTab] = useState<'daily' | 'self_qr'>('daily');

  // Logs & Stats
  const [logs, setLogs] = useState<AttendanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total_check_ins: 0,
    currently_inside: 0,
    morning_check_ins: 0,
    evening_check_ins: 0,
    qr_self_check_ins: 0,
    qr_scan_check_ins: 0,
    manual_check_ins: 0,
  });

  // Receptionist Desk QR & Manual search
  const [qrInput, setQrInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MemberSummary[]>([]);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Self Check-in QR Codes State
  const [qrCodes, setQrCodes] = useState<GymQrItem[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<number | 'all'>('all');
  const [selectedQr, setSelectedQr] = useState<GymQrItem | null>(null);
  const [generatingQr, setGeneratingQr] = useState(false);
  const [qrActivityLogs, setQrActivityLogs] = useState<AttendanceItem[]>([]);
  const [loadingQrActivity, setLoadingQrActivity] = useState(false);

  // Geofencing Form State for selected QR
  const [editingGeofence, setEditingGeofence] = useState(false);
  const [geoReqLocation, setGeoReqLocation] = useState(false);
  const [geoLat, setGeoLat] = useState<string>('');
  const [geoLon, setGeoLon] = useState<string>('');
  const [geoRadius, setGeoRadius] = useState<number>(100);
  const [updatingGeo, setUpdatingGeo] = useState(false);

  // Printable Poster Modal State
  const [posterModalOpen, setPosterModalOpen] = useState(false);
  const [posterLanguage, setPosterLanguage] = useState<'all' | 'mr' | 'hi' | 'en'>('all');
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Instant Verification Modal State (Front Desk)
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

  const fetchQrCodes = async () => {
    try {
      const branchParam = selectedBranchId && selectedBranchId !== 'all' ? `?branch_id=${selectedBranchId}` : '';
      const res = await api.get<{ data: GymQrItem[] }>(`/attendance/qr-codes${branchParam}`);
      const list = res.data.data || [];
      setQrCodes(list);

      // Select first active QR or match activeBranchId
      if (list.length > 0) {
        const found = list.find((q) => q.branch_id === activeBranchId) || list[0];
        setSelectedQr(found);
        loadQrActivity(found.id);
        setGeoReqLocation(found.require_location);
        setGeoLat(found.latitude?.toString() || '');
        setGeoLon(found.longitude?.toString() || '');
        setGeoRadius(found.radius_meters || 100);
      } else {
        setSelectedQr(null);
      }
    } catch (err: any) {
      console.error('Failed to load QR codes:', err);
    }
  };

  const loadQrActivity = async (qrId: number) => {
    try {
      setLoadingQrActivity(true);
      const res = await api.get<{ data: AttendanceItem[] }>(`/attendance/qr-codes/${qrId}/activity`);
      setQrActivityLogs(res.data.data || []);
    } catch {
      setQrActivityLogs([]);
    } finally {
      setLoadingQrActivity(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [activeBranchId]);

  useEffect(() => {
    if (activeTab === 'self_qr') {
      fetchQrCodes();
    }
  }, [activeTab, selectedBranchId]);

  // Search members for receptionist
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
      setToastMessage(errorMessage(err));
    } finally {
      setCheckInLoading(false);
    }
  };

  const handleManualCheckIn = async (member: MemberSummary) => {
    setCheckInLoading(true);
    setToastMessage(null);
    try {
      const res = await submitWithOutbox('/attendance/check-in', {
        member_id: member.id,
        branch_id: activeBranchId,
        method: 'front_desk',
      }, `Check-in: ${member.first_name} (${member.member_code})`);

      if (res.queued) {
        setToastMessage(`Check-in for ${member.first_name} queued offline in Outbox.`);
      } else {
        const data = (res.data as any) || {};
        setVerificationModal({
          open: true,
          member: data.log?.member || member,
          plan_name: data.plan_name || 'Standard Package',
          is_expired: data.is_expired,
          is_frozen: data.is_frozen,
          remaining_days: data.remaining_days ?? 30,
          outstanding_balance: data.outstanding_balance ?? 0,
          already_inside: data.already_checked_in,
          action: 'checked_in',
          message: data.message || `Check-in recorded for ${member.first_name}`,
        });
      }

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

  // QR Generation & Management Actions
  const handleGenerateNewQr = async (branchId?: number) => {
    try {
      setGeneratingQr(true);
      const targetBranch = branchId || (selectedBranchId !== 'all' ? selectedBranchId : activeBranchId);
      const res = await api.post<any>('/attendance/qr-codes', {
        branch_id: targetBranch,
        name: 'Member Self Check-In QR',
      });
      setToastMessage('Unique Self Check-in QR code generated successfully!');
      await fetchQrCodes();
      if (res.data.qr) {
        setSelectedQr(res.data.qr);
        loadQrActivity(res.data.qr.id);
      }
    } catch (err: any) {
      setToastMessage(errorMessage(err));
    } finally {
      setGeneratingQr(false);
    }
  };

  const handleRegenerateQr = async () => {
    if (!selectedQr) return;
    if (!window.confirm('Regenerating will revoke the current QR code token immediately. Any previously printed posters using this QR will no longer work. Do you want to proceed?')) {
      return;
    }
    try {
      const res = await api.post<any>(`/attendance/qr-codes/${selectedQr.id}/regenerate`);
      setToastMessage('QR code token regenerated! A new secure token is now live.');
      setSelectedQr(res.data.qr);
      fetchQrCodes();
    } catch (err) {
      setToastMessage(errorMessage(err));
    }
  };

  const handleToggleQrStatus = async () => {
    if (!selectedQr) return;
    try {
      const res = await api.post<any>(`/attendance/qr-codes/${selectedQr.id}/toggle-status`);
      const newActive = res.data.qr.is_active;
      setToastMessage(newActive ? 'QR code has been activated.' : 'QR code has been deactivated.');
      setSelectedQr(res.data.qr);
      fetchQrCodes();
    } catch (err) {
      setToastMessage(errorMessage(err));
    }
  };

  const handleSaveGeofence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQr) return;
    try {
      setUpdatingGeo(true);
      const res = await api.put<any>(`/attendance/qr-codes/${selectedQr.id}`, {
        require_location: geoReqLocation,
        latitude: geoLat ? parseFloat(geoLat) : null,
        longitude: geoLon ? parseFloat(geoLon) : null,
        radius_meters: geoRadius,
      });
      setToastMessage('Geofencing and entrance security settings saved!');
      setSelectedQr(res.data.qr);
      setEditingGeofence(false);
      fetchQrCodes();
    } catch (err) {
      setToastMessage(errorMessage(err));
    } finally {
      setUpdatingGeo(false);
    }
  };

  const handleDetectCoordinates = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLat(pos.coords.latitude.toFixed(6));
        setGeoLon(pos.coords.longitude.toFixed(6));
        setToastMessage(`Detected coordinates: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
      },
      (err) => {
        alert('Could not determine current location. Please check browser permissions.');
      },
      { enableHighAccuracy: true }
    );
  };

  const handleDownloadPng = () => {
    if (!selectedQr) return;
    const canvas = document.getElementById('qr-canvas-download') as HTMLCanvasElement;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `GymOS-${selectedQr.code}.png`;
    a.click();
    setToastMessage('QR code PNG downloaded successfully!');
  };

  const copyCheckInUrl = () => {
    if (!selectedQr) return;
    const url = `${window.location.origin}/check-in/${selectedQr.token}`;
    navigator.clipboard.writeText(url);
    setToastMessage('Public check-in link copied to clipboard!');
  };

  const printPoster = () => {
    window.print();
  };

  const publicUrl = selectedQr ? `${window.location.origin}/check-in/${selectedQr.token}` : '';

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header & Tab Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <CalendarCheck className="w-6 h-6 text-emerald-400" />
            <span>{t('attendance.title', 'Attendance & Access Control')}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {t('attendance.subtitle', 'Live branch occupancy, front-desk verification and self-attendance QR posters')}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-2xl self-start md:self-auto">
          <button
            onClick={() => setActiveTab('daily')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'daily'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <CalendarCheck className="w-4 h-4" />
            <span>{t('attendance.tab_daily', 'Daily Check-In & Floor')}</span>
          </button>
          <button
            onClick={() => setActiveTab('self_qr')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer relative ${
              activeTab === 'self_qr'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>{t('attendance.tab_self_qr', 'Member Self Check-In QR')}</span>
            <span className="px-1.5 py-0.2 bg-teal-400/20 text-teal-300 text-[9px] font-black rounded-md border border-teal-400/30 uppercase">
              New
            </span>
          </button>
        </div>
      </div>

      {toastMessage && (
        <div className="p-3 bg-slate-800 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white cursor-pointer ml-3">✕</button>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 1: DAILY RECEPTIONIST DESK & OCCUPANCY                     */}
      {/* ============================================================== */}
      {activeTab === 'daily' && (
        <div className="space-y-6">
          {/* Live Counter Badges */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-[#0f172a] border border-slate-800 p-4 rounded-2xl flex items-center gap-3.5 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                <Activity className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <span className="text-slate-400 uppercase tracking-wider block text-[10px] font-semibold">
                  {t('attendance.inside_now', 'On Floor')}
                </span>
                <span className="text-2xl font-black text-white">
                  {formatNumber(stats.currently_inside, i18n.language)}
                </span>
              </div>
            </div>

            <div className="bg-[#0f172a] border border-slate-800 p-4 rounded-2xl flex items-center gap-3.5 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <span className="text-slate-400 uppercase tracking-wider block text-[10px] font-semibold">
                  {t('dashboard.today_attendance', "Today's Total")}
                </span>
                <span className="text-2xl font-black text-white">
                  {formatNumber(stats.total_check_ins, i18n.language)}
                </span>
              </div>
            </div>

            <div className="bg-[#0f172a] border border-slate-800 p-4 rounded-2xl flex items-center gap-3.5 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <span className="text-slate-400 uppercase tracking-wider block text-[10px] font-semibold">
                  {t('attendance.qr_self', 'Self QR Scans')}
                </span>
                <span className="text-2xl font-black text-white">
                  {formatNumber(stats.qr_self_check_ins || 0, i18n.language)}
                </span>
              </div>
            </div>

            <div className="bg-[#0f172a] border border-slate-800 p-4 rounded-2xl flex items-center gap-3.5 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <span className="text-slate-400 uppercase tracking-wider block text-[10px] font-semibold">
                  {t('attendance.morning_eve', 'Morning / Eve')}
                </span>
                <span className="text-base font-bold text-white">
                  {formatNumber(stats.morning_check_ins, i18n.language)} / {formatNumber(stats.evening_check_ins, i18n.language)}
                </span>
              </div>
            </div>
          </div>

          {/* QR Scanner & Quick Search Console */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {/* Box 1: Receptionist Barcode/QR Reader Input */}
            <div className="bg-gradient-to-br from-[#0f172a] to-[#131b2e] border border-emerald-500/30 p-4 sm:p-5 rounded-2xl shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-bold text-white text-sm sm:text-base">
                    {t('attendance.scan_member_pass', 'Front Desk Barcode / QR Scanner')}
                  </h3>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                  {t('attendance.usb_camera', 'USB / Scanner Ready')}
                </span>
              </div>

              <form onSubmit={handleQrCheckIn} className="flex gap-2">
                <input
                  type="text"
                  value={qrInput}
                  onChange={(e) => setQrInput(e.target.value)}
                  placeholder={t('attendance.scan_input_placeholder', 'Scan digital card or enter member code...')}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                  disabled={checkInLoading}
                />
                <button
                  type="submit"
                  disabled={checkInLoading || !qrInput.trim()}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs sm:text-sm cursor-pointer disabled:opacity-50 transition"
                >
                  {checkInLoading ? <RotateCcw className="w-4 h-4 animate-spin" /> : t('attendance.btn_check_in', 'Check In')}
                </button>
              </form>
              <p className="text-[11px] text-slate-400">
                {t('attendance.scan_tip', 'Works with standard hardware USB laser scanners and digital member wallet cards.')}
              </p>
            </div>

            {/* Box 2: Manual Member Search */}
            <div className="bg-[#0f172a] border border-slate-800 p-4 sm:p-5 rounded-2xl shadow-xl space-y-3 relative">
              <div className="flex items-center gap-2">
                <Search className="w-5 h-5 text-sky-400" />
                <h3 className="font-bold text-white text-sm sm:text-base">
                  {t('attendance.manual_lookup', 'Manual Receptionist Lookup')}
                </h3>
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('attendance.search_placeholder', 'Search by athlete name, mobile or member code...')}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>

              {/* Autocomplete dropdown */}
              {searchResults.length > 0 && (
                <div className="absolute left-4 right-4 top-[105px] z-20 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto divide-y divide-slate-800">
                  {searchResults.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => handleManualCheckIn(m)}
                      className="p-3 hover:bg-slate-800 flex items-center justify-between cursor-pointer transition text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-emerald-400">
                          {m.first_name[0]}
                        </div>
                        <div>
                          <div className="font-semibold text-white">{m.first_name} {m.last_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{m.member_code} • {m.phone}</div>
                        </div>
                      </div>
                      <button
                        className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 font-bold rounded-lg text-[10px] transition"
                      >
                        {t('attendance.btn_check_in', 'Check In')}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-[11px] text-slate-400">
                {t('attendance.manual_tip', 'Quick check-in when members forget their digital pass or smartphone.')}
              </p>
            </div>
          </div>

          {/* Today's Attendance Punch Logs */}
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-sm sm:text-base">
                  {t('attendance.today_log', "Today's Floor Punch Log")}
                </h3>
                <p className="text-xs text-slate-400">
                  {t('attendance.log_subtitle', 'Real-time record of members currently checked in or completed')}
                </p>
              </div>
              <button
                onClick={fetchAttendance}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                title="Refresh"
              >
                <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {loading ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                {t('common.loading', 'Loading live attendance feed...')}
              </div>
            ) : logs.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs space-y-2">
                <CalendarCheck className="w-8 h-8 mx-auto text-slate-600" />
                <p>{t('attendance.no_checkins', 'No check-ins recorded yet today.')}</p>
              </div>
            ) : (
              <>
                {/* Mobile Cards View (< md) */}
                <div className="md:hidden divide-y divide-slate-800/70">
                  {logs.map((item) => {
                    const isInside = !item.check_out_at;
                    return (
                      <div key={item.id} className="p-4 hover:bg-slate-800/30 transition-colors space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-bold text-sm text-white">
                              {item.member?.first_name} {item.member?.last_name}
                            </h4>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {item.member?.member_code} • {item.member?.phone}
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium capitalize ${
                            item.method === 'qr_self_check_in'
                              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                              : 'bg-slate-800 text-slate-300'
                          }`}>
                            {item.method === 'qr_self_check_in' ? 'Self QR' : item.method.replace('_', ' ')}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/60">
                          <div className="space-y-0.5">
                            <span className="text-[10px] text-slate-400 uppercase font-semibold block">In: {item.check_in_at}</span>
                            <span className="text-[10px] text-slate-500 font-mono block">
                              Out: {item.check_out_at || 'Currently on floor'}
                            </span>
                          </div>

                          <div>
                            {isInside ? (
                              <button
                                onClick={() => handleCheckOut(item.id)}
                                className="px-3.5 py-2 bg-sky-500/20 hover:bg-sky-500 text-sky-400 hover:text-slate-950 font-bold rounded-xl text-xs cursor-pointer transition-colors inline-flex items-center gap-1.5 min-h-[40px]"
                              >
                                <LogOut className="w-3.5 h-3.5" />
                                <span>Check Out</span>
                              </button>
                            ) : (
                              <span className="text-xs text-slate-500 font-medium px-2 py-1 bg-slate-900 rounded-lg border border-slate-800">
                                Completed
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table View (>= md) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/60 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">{t('attendance.col_member_name', 'Member Name')}</th>
                        <th className="py-3 px-4">{t('attendance.col_member_code', 'Member Code')}</th>
                        <th className="py-3 px-4">{t('common.phone', 'Phone')}</th>
                        <th className="py-3 px-4">{t('attendance.time_in', 'Check-in Time')}</th>
                        <th className="py-3 px-4">{t('common.type', 'Method')}</th>
                        <th className="py-3 px-4">{t('attendance.time_out', 'Check-out Time')}</th>
                        <th className="py-3 px-4 text-right">{t('attendance.col_floor_status', 'Floor Status')}</th>
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
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium capitalize ${
                                item.method === 'qr_self_check_in'
                                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                                  : 'bg-slate-800 text-slate-300'
                              }`}>
                                {item.method === 'qr_self_check_in' ? 'Self QR' : item.method.replace('_', ' ')}
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
              </>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: MEMBER SELF CHECK-IN QR & POSTER GENERATOR              */}
      {/* ============================================================== */}
      {activeTab === 'self_qr' && (
        <div className="space-y-6">
          {/* Branch Filter & Quick Creation Bar */}
          <div className="bg-[#0f172a] border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm sm:text-base">
                  {t('attendance.branch_qrs', 'Branch Self Check-In QR Posters')}
                </h3>
                <p className="text-xs text-slate-400">
                  {t('attendance.branch_qrs_subtitle', 'Generate high-resolution printable posters for gym entrance')}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Branch Selector */}
              {user?.branches && user.branches.length > 1 && (
                <select
                  value={selectedBranchId}
                  onChange={(e) => {
                    const val = e.target.value === 'all' ? 'all' : parseInt(e.target.value);
                    setSelectedBranchId(val);
                  }}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                >
                  <option value="all">All Gym Branches</option>
                  {user.branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              )}

              <button
                onClick={() => handleGenerateNewQr()}
                disabled={generatingQr}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition cursor-pointer shadow-md shadow-emerald-600/20 disabled:opacity-50"
              >
                <QrCode className="w-4 h-4" />
                <span>{generatingQr ? 'Generating...' : 'Generate New QR'}</span>
              </button>
            </div>
          </div>

          {/* Main QR Workbench */}
          {qrCodes.length === 0 ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center shadow-xl space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-400">
                <QrCode className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto">
                <h3 className="text-lg font-bold text-white">
                  No Self Check-in QR Codes Generated Yet
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Generate a unique QR code for your gym branches. Print it on A4 paper and stick it at your front entrance so members can scan with their smartphone camera to mark attendance.
                </p>
              </div>
              <button
                onClick={() => handleGenerateNewQr()}
                disabled={generatingQr}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm transition cursor-pointer shadow-lg shadow-emerald-600/30"
              >
                {generatingQr ? 'Generating...' : 'Generate First QR Poster'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: QR Code Visual & Actions (7 cols) */}
              <div className="lg:col-span-7 bg-[#0f172a] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
                {/* QR Selector Pills if multiple */}
                {qrCodes.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-2 border-b border-slate-800">
                    {qrCodes.map((q) => (
                      <button
                        key={q.id}
                        onClick={() => {
                          setSelectedQr(q);
                          loadQrActivity(q.id);
                          setGeoReqLocation(q.require_location);
                          setGeoLat(q.latitude?.toString() || '');
                          setGeoLon(q.longitude?.toString() || '');
                          setGeoRadius(q.radius_meters || 100);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                          selectedQr?.id === q.id
                            ? 'bg-emerald-600 text-white font-bold'
                            : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{q.branch?.name || q.code}</span>
                      </button>
                    ))}
                  </div>
                )}

                {selectedQr && (
                  <>
                    {/* Header info */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-extrabold text-white text-base">
                            {selectedQr.name}
                          </h3>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            selectedQr.is_active
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}>
                            {selectedQr.is_active ? 'Active' : 'Deactivated'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>{selectedQr.branch?.name} • {selectedQr.branch?.city || 'Main Branch'}</span>
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 font-mono block">Code</span>
                        <span className="text-xs font-mono font-bold text-slate-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                          {selectedQr.code}
                        </span>
                      </div>
                    </div>

                    {/* QR Code Presentation Box */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center bg-slate-950/70 border border-slate-800/80 p-5 rounded-2xl">
                      {/* Live Canvas / SVG Preview */}
                      <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl shadow-xl w-fit mx-auto sm:mx-0">
                        <QRCodeCanvas
                          id="qr-canvas-download"
                          value={publicUrl}
                          size={180}
                          level="H"
                          marginSize={2}
                        />
                      </div>

                      {/* Details & Direct URL */}
                      <div className="space-y-3">
                        <div>
                          <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                            Public Self Check-In URL
                          </label>
                          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-2 rounded-xl text-xs font-mono text-emerald-400 overflow-hidden">
                            <span className="truncate flex-1">{publicUrl}</span>
                            <button
                              onClick={copyCheckInUrl}
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-sans text-[11px] font-semibold cursor-pointer shrink-0 transition"
                            >
                              Copy
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800/60">
                            <span className="text-[10px] text-slate-400 block">Total Scans</span>
                            <span className="text-base font-black text-white">
                              {selectedQr.scan_count || 0}
                            </span>
                          </div>
                          <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800/60">
                            <span className="text-[10px] text-slate-400 block">GPS Shield</span>
                            <span className={`text-xs font-bold ${selectedQr.require_location ? 'text-emerald-400' : 'text-slate-400'}`}>
                              {selectedQr.require_location ? `Active (${selectedQr.radius_meters}m)` : 'Disabled'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons: Print Poster, Download PNG, Regenerate, Toggle */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                      <button
                        onClick={() => setPosterModalOpen(true)}
                        className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md shadow-emerald-600/30"
                      >
                        <Printer className="w-4 h-4" />
                        <span>Print A4 Poster</span>
                      </button>

                      <button
                        onClick={handleDownloadPng}
                        className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer border border-slate-700"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download PNG</span>
                      </button>

                      <button
                        onClick={handleToggleQrStatus}
                        className={`py-2.5 px-3 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer border ${
                          selectedQr.is_active
                            ? 'bg-rose-950/30 border-rose-500/30 text-rose-300 hover:bg-rose-900/40'
                            : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300 hover:bg-emerald-900/40'
                        }`}
                      >
                        <Power className="w-4 h-4" />
                        <span>{selectedQr.is_active ? 'Deactivate' : 'Activate'}</span>
                      </button>

                      <button
                        onClick={handleRegenerateQr}
                        className="py-2.5 px-3 bg-amber-950/30 hover:bg-amber-900/40 border border-amber-500/30 text-amber-300 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                        title="Invalidates previous token if compromised"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>Regenerate</span>
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Right Column: Security & Fraud Prevention (5 cols) */}
              <div className="lg:col-span-5 bg-[#0f172a] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <h3 className="font-bold text-white text-sm">
                      Entrance Geofence & Fraud Shield
                    </h3>
                  </div>
                  <span className="text-[10px] text-slate-400">Optional</span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  Prevent members from marking attendance remotely by sharing photos of the QR poster. Require physical presence within your gym entrance radius.
                </p>

                <form onSubmit={handleSaveGeofence} className="space-y-4">
                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 cursor-pointer">
                    <div>
                      <span className="text-xs font-bold text-white block">
                        Require GPS Geofencing
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        Member mobile browser will verify entrance coordinates
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={geoReqLocation}
                      onChange={(e) => setGeoReqLocation(e.target.checked)}
                      className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                    />
                  </label>

                  {geoReqLocation && (
                    <div className="space-y-3 p-3 bg-slate-950/50 rounded-xl border border-slate-800 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-300">
                          Gym Entrance Coordinates
                        </span>
                        <button
                          type="button"
                          onClick={handleDetectCoordinates}
                          className="text-[10px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Navigation className="w-3 h-3" />
                          <span>Detect Location</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-0.5">Latitude</label>
                          <input
                            type="text"
                            value={geoLat}
                            onChange={(e) => setGeoLat(e.target.value)}
                            placeholder="e.g. 18.5204"
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-0.5">Longitude</label>
                          <input
                            type="text"
                            value={geoLon}
                            onChange={(e) => setGeoLon(e.target.value)}
                            placeholder="e.g. 73.8567"
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-slate-400">Allowed Distance Radius</span>
                          <span className="font-bold text-emerald-400">{geoRadius} meters</span>
                        </div>
                        <input
                          type="range"
                          min="30"
                          max="500"
                          step="10"
                          value={geoRadius}
                          onChange={(e) => setGeoRadius(parseInt(e.target.value))}
                          className="w-full accent-emerald-500 cursor-pointer"
                        />
                        <div className="flex justify-between text-[9px] text-slate-500 mt-0.5">
                          <span>30m (Strict entrance)</span>
                          <span>150m (Building floor)</span>
                          <span>500m (Campus)</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={updatingGeo}
                    className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs transition cursor-pointer border border-slate-700 flex items-center justify-center gap-2"
                  >
                    {updatingGeo ? <RotateCcw className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5 text-emerald-400" />}
                    <span>Save Security Policy</span>
                  </button>
                </form>
              </div>

              {/* Bottom Row: Today's Self Check-in Activity Log (12 cols) */}
              <div className="lg:col-span-12 bg-[#0f172a] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-emerald-400" />
                    <h3 className="font-bold text-white text-sm">
                      Today's Self Check-In Activity Feed
                    </h3>
                  </div>
                  {selectedQr && (
                    <button
                      onClick={() => loadQrActivity(selectedQr.id)}
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                      title="Refresh"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${loadingQrActivity ? 'animate-spin' : ''}`} />
                    </button>
                  )}
                </div>

                {loadingQrActivity ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    Loading scan activity...
                  </div>
                ) : qrActivityLogs.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    No members have checked in via this QR code yet today.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900/60 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                        <tr>
                          <th className="py-2.5 px-4">Member Name</th>
                          <th className="py-2.5 px-4">Member Code</th>
                          <th className="py-2.5 px-4">Mobile</th>
                          <th className="py-2.5 px-4">Check-In Time</th>
                          <th className="py-2.5 px-4">Check-Out</th>
                          <th className="py-2.5 px-4 text-right">Method</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-200">
                        {qrActivityLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-800/30">
                            <td className="py-2.5 px-4 font-semibold text-white">
                              {log.member?.first_name} {log.member?.last_name}
                            </td>
                            <td className="py-2.5 px-4 font-mono text-slate-400">
                              {log.member?.member_code}
                            </td>
                            <td className="py-2.5 px-4 font-mono text-slate-300">
                              {log.member?.phone}
                            </td>
                            <td className="py-2.5 px-4 font-mono text-emerald-400">
                              {log.check_in_at}
                            </td>
                            <td className="py-2.5 px-4 font-mono text-slate-400">
                              {log.check_out_at || 'Currently inside'}
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-teal-500/20 text-teal-300 border border-teal-500/30">
                                Mobile Camera Scan
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* PRINTABLE A4 POSTER MODAL                                      */}
      {/* ============================================================== */}
      {posterModalOpen && selectedQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
          {/* Print container with screen controls */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
            {/* Modal Screen-only Toolbar */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/90 print:hidden">
              <div className="flex items-center gap-3">
                <Printer className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-bold text-white text-sm">
                    Printable A4 QR Attendance Poster
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    High contrast, print-ready design for entrance doors and front desks
                  </p>
                </div>
              </div>

              {/* Poster Language Switcher */}
              <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-xs">
                <button
                  onClick={() => setPosterLanguage('all')}
                  className={`px-2 py-1 rounded font-medium transition ${
                    posterLanguage === 'all' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All (3-in-1)
                </button>
                <button
                  onClick={() => setPosterLanguage('en')}
                  className={`px-2 py-1 rounded font-medium transition ${
                    posterLanguage === 'en' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  EN
                </button>
                <button
                  onClick={() => setPosterLanguage('mr')}
                  className={`px-2 py-1 rounded font-medium transition ${
                    posterLanguage === 'mr' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  मराठी
                </button>
                <button
                  onClick={() => setPosterLanguage('hi')}
                  className={`px-2 py-1 rounded font-medium transition ${
                    posterLanguage === 'hi' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  हिंदी
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={printPoster}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-emerald-600/30"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print (A4)</span>
                </button>
                <button
                  onClick={() => setPosterModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* The Print Area (Clean white background for sharp printer output) */}
            <div className="p-6 md:p-10 overflow-y-auto bg-slate-950 flex justify-center print:p-0 print:bg-white print:overflow-visible">
              <div
                id="printable-poster"
                className="w-full max-w-[500px] bg-white text-slate-900 rounded-2xl p-8 border-2 border-slate-200 shadow-2xl flex flex-col justify-between items-center text-center print:border-none print:shadow-none print:rounded-none print:max-w-none print:w-full print:p-8"
                style={{ minHeight: '680px' }}
              >
                {/* Gym Logo & Header */}
                <div className="space-y-2 mb-4 w-full">
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center font-black text-emerald-400 text-xl shadow-md">
                      <Dumbbell className="w-7 h-7 text-emerald-400" />
                    </div>
                    <div className="text-left">
                      <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-tight uppercase">
                        {user?.gym?.name || 'GYMOS FITNESS'}
                      </h1>
                      <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest">
                        {selectedQr.branch?.name || 'Main Branch'}
                      </p>
                    </div>
                  </div>
                  {selectedQr.branch?.address && (
                    <p className="text-[11px] text-slate-500 font-medium pt-1 border-t border-slate-100">
                      📍 {selectedQr.branch.address}, {selectedQr.branch.city}
                    </p>
                  )}
                </div>

                {/* Banner Call To Action */}
                <div className="my-3 space-y-1 w-full bg-slate-900 text-white py-3 px-4 rounded-xl shadow-md">
                  {(posterLanguage === 'all' || posterLanguage === 'en') && (
                    <h2 className="text-base font-black tracking-wide text-white">
                      SCAN TO MARK ATTENDANCE
                    </h2>
                  )}
                  {(posterLanguage === 'all' || posterLanguage === 'mr') && (
                    <h2 className="text-base font-black text-emerald-400">
                      हजेरी नोंदवण्यासाठी स्कॅन करा
                    </h2>
                  )}
                  {(posterLanguage === 'all' || posterLanguage === 'hi') && (
                    <h3 className="text-sm font-bold text-slate-200">
                      उपस्थिति दर्ज करने के लिए स्कैन करें
                    </h3>
                  )}
                </div>

                {/* High-Resolution Vector QR Code */}
                <div className="my-4 p-5 bg-white border-4 border-slate-900 rounded-3xl shadow-inner relative flex items-center justify-center">
                  {/* Decorative Scan Target Corners */}
                  <div className="absolute top-2 left-2 w-4 h-4 border-t-4 border-l-4 border-emerald-500" />
                  <div className="absolute top-2 right-2 w-4 h-4 border-t-4 border-r-4 border-emerald-500" />
                  <div className="absolute bottom-2 left-2 w-4 h-4 border-b-4 border-l-4 border-emerald-500" />
                  <div className="absolute bottom-2 right-2 w-4 h-4 border-b-4 border-r-4 border-emerald-500" />

                  <QRCodeSVG
                    value={publicUrl}
                    size={220}
                    level="H"
                    marginSize={1}
                  />
                </div>

                {/* 3 Simple Instructions */}
                <div className="grid grid-cols-3 gap-2 w-full my-3 text-center">
                  <div className="p-2 bg-slate-50 rounded-xl border border-slate-200/80">
                    <span className="text-base block mb-0.5">📷</span>
                    <span className="text-[10px] font-bold text-slate-900 block">1. Open Camera</span>
                    <span className="text-[9px] text-slate-500 block">कॅमेरा उघडा</span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-xl border border-slate-200/80">
                    <span className="text-base block mb-0.5">📲</span>
                    <span className="text-[10px] font-bold text-slate-900 block">2. Scan QR</span>
                    <span className="text-[9px] text-slate-500 block">स्कॅन करा</span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-xl border border-slate-200/80">
                    <span className="text-base block mb-0.5">✅</span>
                    <span className="text-[10px] font-bold text-slate-900 block">3. Confirm In</span>
                    <span className="text-[9px] text-slate-500 block">हजेरी नोंदवा</span>
                  </div>
                </div>

                {/* Footer notes */}
                <div className="pt-3 border-t border-slate-200 w-full text-center space-y-1">
                  <p className="text-[10px] font-semibold text-slate-600">
                    Open your smartphone camera, scan the QR code and enter your registered phone number.
                  </p>
                  <p className="text-[9px] text-slate-400 font-mono">
                    Facility Code: {selectedQr.code} • Powered by GymOS
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* INSTANT VERIFICATION MODAL (FRONT DESK)                         */}
      {/* ============================================================== */}
      {verificationModal && verificationModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#0f172a] border border-slate-700 rounded-3xl max-w-sm w-full p-6 shadow-2xl relative space-y-4">
            <button
              onClick={() => setVerificationModal(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Status Header Icon */}
            <div className="text-center space-y-2">
              {verificationModal.is_expired ? (
                <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
                  <ShieldAlert className="w-8 h-8" />
                </div>
              ) : verificationModal.is_frozen ? (
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
                  <AlertTriangle className="w-8 h-8" />
                </div>
              ) : verificationModal.already_inside ? (
                <div className="w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center mx-auto text-sky-400">
                  <UserCheck className="w-8 h-8" />
                </div>
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
              )}

              <h3 className="text-lg font-black text-white">
                {verificationModal.member?.first_name} {verificationModal.member?.last_name}
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                {verificationModal.member?.member_code} • {verificationModal.member?.phone}
              </p>
            </div>

            {/* Badges / Details */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Package:</span>
                <span className="font-semibold text-white">{verificationModal.plan_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Days Remaining:</span>
                <span className={`font-bold ${
                  (verificationModal.remaining_days ?? 0) <= 5 ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {verificationModal.remaining_days} days
                </span>
              </div>
              {(verificationModal.outstanding_balance ?? 0) > 0 && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-rose-400 font-bold">
                  <span>Balance Due:</span>
                  <span>₹{verificationModal.outstanding_balance}</span>
                </div>
              )}
            </div>

            {/* Action button */}
            <button
              onClick={() => setVerificationModal(null)}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
