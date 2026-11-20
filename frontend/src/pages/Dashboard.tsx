import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bot,
  Building2,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  Dumbbell,
  HelpCircle,
  MessageCircle,
  Package,
  Plus,
  Receipt,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  X,
  Zap,
} from 'lucide-react';
import api, { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatNumber } from '../lib/formatters';

interface OwnerDashboardData {
  period: string;
  from: string;
  to: string;
  executive_kpis: {
    total_members: number;
    active_members: number;
    new_members: number;
    expiring_memberships: number;
    today_attendance: number;
    currently_inside: number;
    membership_collections: number;
    outstanding_dues: number;
    supplement_revenue: number;
    supplement_collected: number;
    supplement_cogs: number;
    supplement_gross_profit: number;
    supplement_gross_margin_percent: number;
    total_expenses: number;
    operating_profit: number;
    operating_margin_percent: number;
    total_leads: number;
    converted_leads: number;
    conversion_rate: number;
  };
  branch_performance: Array<{
    id: number;
    name: string;
    code?: string;
    active_members: number;
    collections: number;
    supplement_sales: number;
    expenses: number;
    operating_profit: number;
  }>;
  growth_trend: {
    revenue_growth_percent: number;
    profit_growth_percent: number;
  };
}

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, activeBranch, activeBranchId } = useAuth();
  const [data, setData] = useState<OwnerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Period Filter: 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom'
  const [period, setPeriod] = useState<string>('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // Setup Guide Banner State
  const [showSetupGuide, setShowSetupGuide] = useState<boolean>(() => {
    return localStorage.getItem('gym_setup_guide_dismissed') !== 'true';
  });

  const dismissSetupGuide = () => {
    setShowSetupGuide(false);
    localStorage.setItem('gym_setup_guide_dismissed', 'true');
  };

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, string> = { period };
      if (period === 'custom') {
        if (customFrom) params.from = customFrom;
        if (customTo) params.to = customTo;
      }
      if (activeBranchId) {
        params.branch_id = activeBranchId.toString();
      }

      const res = await api.get('/owner-dashboard', { params });
      setData(res.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [period, activeBranchId]);

  const kpis = data?.executive_kpis;

  // Attention counters
  const expiringCount = kpis?.expiring_memberships ?? 0;
  const duesCount = (kpis?.outstanding_dues ?? 0) > 0 ? 1 : 0;
  const leadsCount = kpis?.total_leads ?? 0;
  const totalAttentionCount = (expiringCount > 0 ? 1 : 0) + duesCount;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Banner / Welcome & Quick Primary Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5 sm:gap-3">
            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>{t('dashboard.title', 'Gym Dashboard')}</span>
              {activeBranch && (
                <span className="text-[10px] sm:text-xs px-2 sm:px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-emerald-400 font-semibold truncate max-w-[140px] sm:max-w-none">
                  {activeBranch.name}
                </span>
              )}
            </h1>
            <span className="text-[10px] px-2 sm:px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20 shrink-0">
              {t('common.live_badge', 'Live')}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {t('dashboard.subtitle', "Today's performance, actions needed, and next steps")}
          </p>
        </div>

        {/* Quick Action Navigation Buttons - Clean 3-col grid on mobile, flex row on desktop */}
        <div className="grid grid-cols-3 gap-1.5 w-full md:w-auto md:flex md:items-center md:gap-2">
          <Link
            to="/members?action=new"
            className="px-2 sm:px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1 sm:gap-1.5 transition-colors shadow-lg shadow-emerald-950/40 cursor-pointer min-h-[44px] text-center"
          >
            <UserPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate">{t('quickActions.add_member', 'Add Member')}</span>
          </Link>
          <Link
            to="/attendance"
            className="px-2 sm:px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1 sm:gap-1.5 transition-colors border border-slate-700 cursor-pointer min-h-[44px] text-center"
          >
            <CalendarCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
            <span className="truncate">{t('common.attendance', 'Attendance')}</span>
          </Link>
          <Link
            to="/payments?action=new"
            className="px-2 sm:px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1 sm:gap-1.5 transition-colors border border-slate-700 cursor-pointer min-h-[44px] text-center"
          >
            <Receipt className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
            <span className="truncate">{t('members.collect_due', 'Collect Fee')}</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* First-Time Guided Onboarding Checklist (Phase 6: First-Time User Experience) */}
      {showSetupGuide && (
        <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-2xl p-3.5 sm:p-5 relative shadow-xl">
          <div className="flex items-start justify-between gap-3 mb-2 sm:mb-3">
            <div className="flex items-center gap-2 sm:gap-2.5">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold shrink-0">
                <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-white">
                  {t('dashboard.setup_checklist_title', 'Quick Start: Set Up Your Gym')}
                </h3>
                <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 line-clamp-1 sm:line-clamp-none">
                  {t('dashboard.setup_checklist_sub', 'Follow these simple steps to start running your gym operations effortlessly')}
                </p>
              </div>
            </div>
            <button
              onClick={dismissSetupGuide}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors shrink-0"
              title={t('dashboard.dismiss_guide', 'Dismiss')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mt-2 sm:mt-4">
            <Link
              to="/plans"
              className="bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 hover:border-emerald-500/40 rounded-xl p-2 sm:p-3 transition-all group flex items-start gap-2 sm:gap-2.5 min-h-[44px]"
            >
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px] sm:text-xs">
                1
              </div>
              <div className="min-w-0">
                <div className="text-[11px] sm:text-xs font-bold text-white group-hover:text-emerald-400 transition-colors line-clamp-1 sm:line-clamp-none">
                  {t('dashboard.step_plans', '1. Add Membership Plans')}
                </div>
                <div className="hidden sm:block text-[11px] text-slate-400 mt-0.5">
                  {t('dashboard.step_plans_desc', 'Set up Monthly, 3-Month, or Annual fees')}
                </div>
              </div>
            </Link>

            <Link
              to="/staff"
              className="bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 hover:border-emerald-500/40 rounded-xl p-2 sm:p-3 transition-all group flex items-start gap-2 sm:gap-2.5 min-h-[44px]"
            >
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px] sm:text-xs">
                2
              </div>
              <div className="min-w-0">
                <div className="text-[11px] sm:text-xs font-bold text-white group-hover:text-emerald-400 transition-colors line-clamp-1 sm:line-clamp-none">
                  {t('dashboard.step_staff', '2. Add Staff & Trainers')}
                </div>
                <div className="hidden sm:block text-[11px] text-slate-400 mt-0.5">
                  {t('dashboard.step_staff_desc', 'Give login access to receptionists or coaches')}
                </div>
              </div>
            </Link>

            <Link
              to="/members?action=new"
              className="bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 hover:border-emerald-500/40 rounded-xl p-2 sm:p-3 transition-all group flex items-start gap-2 sm:gap-2.5 min-h-[44px]"
            >
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px] sm:text-xs">
                3
              </div>
              <div className="min-w-0">
                <div className="text-[11px] sm:text-xs font-bold text-white group-hover:text-emerald-400 transition-colors line-clamp-1 sm:line-clamp-none">
                  {t('dashboard.step_member', '3. Add First Member')}
                </div>
                <div className="hidden sm:block text-[11px] text-slate-400 mt-0.5">
                  {t('dashboard.step_member_desc', 'Register a member with phone number and plan')}
                </div>
              </div>
            </Link>

            <Link
              to="/attendance"
              className="bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 hover:border-emerald-500/40 rounded-xl p-2 sm:p-3 transition-all group flex items-start gap-2 sm:gap-2.5 min-h-[44px]"
            >
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px] sm:text-xs">
                4
              </div>
              <div className="min-w-0">
                <div className="text-[11px] sm:text-xs font-bold text-white group-hover:text-emerald-400 transition-colors line-clamp-1 sm:line-clamp-none">
                  {t('dashboard.step_attendance', '4. Daily Attendance')}
                </div>
                <div className="hidden sm:block text-[11px] text-slate-400 mt-0.5">
                  {t('dashboard.step_attendance_desc', 'Search name or scan QR pass for attendance')}
                </div>
              </div>
            </Link>
          </div>
        </div>
      )}

      {/* Period Selection Bar - Horizontal scrollable without scrollbar tracks */}
      <div className="bg-[#0f172a] border border-slate-800 p-2.5 sm:p-3 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto no-scrollbar pb-0.5 md:pb-0">
          <span className="text-[10px] sm:text-[11px] text-slate-400 uppercase font-bold px-1.5 shrink-0">
            {t('common.timeframe', 'Timeframe')}:
          </span>
          {[
            { id: 'today', label: t('common.today', 'Today') },
            { id: 'yesterday', label: t('common.yesterday', 'Yesterday') },
            { id: 'this_week', label: t('common.this_week', 'This Week') },
            { id: 'this_month', label: t('common.this_month', 'This Month') },
            { id: 'custom', label: t('common.custom_range', 'Custom Range') },
          ].map((btn) => (
            <button
              key={btn.id}
              onClick={() => setPeriod(btn.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 min-h-[36px] flex items-center justify-center ${
                period === btn.id
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-950/30'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {period === 'custom' && (
          <div className="flex items-center gap-2 text-xs w-full md:w-auto justify-between sm:justify-start">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs"
            />
            <span className="text-slate-500">{t('common.to', 'to')}</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs"
            />
            <button
              onClick={fetchDashboard}
              className="px-3 py-1 bg-emerald-500 text-slate-950 font-bold rounded-lg text-xs cursor-pointer min-h-[32px]"
            >
              {t('common.apply', 'Apply')}
            </button>
          </div>
        )}

        <div className="text-[11px] text-slate-400 font-mono hidden md:block">
          {data ? `Range: ${data.from} to ${data.to}` : ''}
        </div>
      </div>

      {/* QUESTION 1: HOW IS MY GYM PERFORMING? (तुमची जिम कशी चालली आहे?) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span>{t('dashboard.how_is_gym_doing', 'How is your gym performing?')}</span>
          </h2>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 md:gap-4">
          {/* Card 1: Active Members */}
          <div className="bg-[#0f172a] border border-slate-800 p-3.5 sm:p-4.5 rounded-xl sm:rounded-2xl flex flex-col justify-between hover:border-slate-700 transition-colors shadow-lg">
            <div>
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] sm:text-[11px] uppercase font-bold tracking-wider truncate">
                  {t('dashboard.active_members', 'Active Members')}
                </span>
                <Users className="w-4 h-4 text-emerald-400 shrink-0 ml-1" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-white mt-1.5 sm:mt-2 truncate">
                {formatNumber(kpis?.active_members ?? 0, i18n.language)}
                <span className="text-[11px] sm:text-xs text-slate-500 font-normal ml-1">
                  / {formatNumber(kpis?.total_members ?? 0, i18n.language)}
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 mt-1 truncate">
                +{formatNumber(kpis?.new_members ?? 0, i18n.language)} {t('common.new_badge', 'new')} {t('common.this_month', 'this month')}
              </p>
            </div>
            <div className="mt-2.5 sm:mt-3 pt-2 sm:pt-2.5 border-t border-slate-800/80">
              <Link
                to="/members"
                className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 min-h-[32px]"
              >
                <span>{t('dashboard.view_members', 'View Members')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Card 2: Today's Attendance */}
          <div className="bg-[#0f172a] border border-slate-800 p-3.5 sm:p-4.5 rounded-xl sm:rounded-2xl flex flex-col justify-between hover:border-slate-700 transition-colors shadow-lg">
            <div>
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] sm:text-[11px] uppercase font-bold tracking-wider truncate">
                  {t('dashboard.today_attendance', "Today's Visits")}
                </span>
                <CalendarCheck className="w-4 h-4 text-sky-400 shrink-0 ml-1" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-white mt-1.5 sm:mt-2 truncate">
                {formatNumber(kpis?.today_attendance ?? 0, i18n.language)}
              </div>
              <p className="text-[10px] sm:text-[11px] text-emerald-400 font-semibold flex items-center gap-1 mt-1 truncate">
                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="truncate">{formatNumber(kpis?.currently_inside ?? 0, i18n.language)} {t('attendance.inside_now', 'on floor now')}</span>
              </p>
            </div>
            <div className="mt-2.5 sm:mt-3 pt-2 sm:pt-2.5 border-t border-slate-800/80">
              <Link
                to="/attendance"
                className="text-xs text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1 min-h-[32px]"
              >
                <span>{t('attendance.check_in', 'Mark Attendance')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Card 3: Fee Collections */}
          <div className="bg-[#0f172a] border border-slate-800 p-3.5 sm:p-4.5 rounded-xl sm:rounded-2xl flex flex-col justify-between hover:border-slate-700 transition-colors shadow-lg">
            <div>
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] sm:text-[11px] uppercase font-bold tracking-wider truncate">
                  {t('dashboard.fees_collected_today', 'Fees Collected')}
                </span>
                <Receipt className="w-4 h-4 text-emerald-400 shrink-0 ml-1" />
              </div>
              <div className="text-xl sm:text-3xl font-black text-emerald-400 mt-1.5 sm:mt-2 font-mono truncate">
                {formatCurrency(kpis?.membership_collections ?? 0, i18n.language)}
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 mt-1 truncate">
                +{data?.growth_trend?.revenue_growth_percent ?? 0}% growth
              </p>
            </div>
            <div className="mt-2.5 sm:mt-3 pt-2 sm:pt-2.5 border-t border-slate-800/80">
              <Link
                to="/payments?action=new"
                className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 min-h-[32px]"
              >
                <span>{t('members.collect_due', '+ Collect Fee')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Card 4: Pending Fees to Collect */}
          <div className="bg-[#0f172a] border border-slate-800 p-3.5 sm:p-4.5 rounded-xl sm:rounded-2xl flex flex-col justify-between hover:border-slate-700 transition-colors shadow-lg">
            <div>
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] sm:text-[11px] uppercase font-bold tracking-wider truncate">
                  {t('dashboard.pending_fees_label', 'Pending Fees')}
                </span>
                <Coins className="w-4 h-4 text-amber-400 shrink-0 ml-1" />
              </div>
              <div className="text-xl sm:text-3xl font-black text-amber-400 mt-1.5 sm:mt-2 font-mono truncate">
                {formatCurrency(kpis?.outstanding_dues ?? 0, i18n.language)}
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 mt-1 truncate">
                {t('actionCenter.members_owing', 'Members owing balance')}
              </p>
            </div>
            <div className="mt-2.5 sm:mt-3 pt-2 sm:pt-2.5 border-t border-slate-800/80">
              <Link
                to="/members?has_due=1"
                className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 min-h-[32px]"
              >
                <span>{t('dashboard.view_and_collect', 'View & Collect')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* QUESTION 2: WHAT NEEDS MY ATTENTION? (कशावर लक्ष देणे आवश्यक आहे?) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <span>{t('dashboard.what_needs_attention', 'What needs your attention?')}</span>
          </h2>
          <Link
            to="/action-center"
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
          >
            <span>{t('nav.action_center', 'All Actions')}</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {totalAttentionCount === 0 && leadsCount === 0 ? (
          <div className="p-3.5 sm:p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl sm:rounded-2xl flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <p className="text-xs text-emerald-300 font-medium">
              {t('dashboard.all_good_no_issues', 'Everything is running smoothly! No urgent actions needed.')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-3">
            {/* Attention Item 1: Memberships Expiring Soon */}
            <div className="bg-[#0f172a] border border-amber-500/30 rounded-xl sm:rounded-2xl p-3.5 sm:p-4 flex items-center justify-between shadow-md gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
                  <span className="text-xs font-bold text-white truncate">
                    {formatNumber(expiringCount, i18n.language)} {t('dashboard.expiring_memberships', 'Memberships Expiring')}
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-slate-400 pl-4.5 truncate">
                  {t('actionCenter.need_renewals', 'Memberships ending in next 7 days')}
                </p>
              </div>
              <Link
                to="/action-center?search=expiring"
                className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-bold transition-colors shrink-0 min-h-[36px] flex items-center justify-center"
              >
                {t('members.renew_membership', 'Renew')}
              </Link>
            </div>

            {/* Attention Item 2: Pending Fees */}
            <div className="bg-[#0f172a] border border-rose-500/30 rounded-xl sm:rounded-2xl p-3.5 sm:p-4 flex items-center justify-between shadow-md gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-400 shrink-0" />
                  <span className="text-xs font-bold text-white truncate">
                    {formatCurrency(kpis?.outstanding_dues ?? 0, i18n.language)} {t('dashboard.pending_fees_label', 'Pending Fees')}
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-slate-400 pl-4.5 truncate">
                  {t('actionCenter.members_owing', 'Outstanding gym & supplement dues')}
                </p>
              </div>
              <Link
                to="/members?has_due=1"
                className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-bold transition-colors shrink-0 min-h-[36px] flex items-center justify-center"
              >
                {t('members.collect_due', 'Collect')}
              </Link>
            </div>

            {/* Attention Item 3: Prospective Enquiries */}
            <div className="bg-[#0f172a] border border-blue-500/30 rounded-xl sm:rounded-2xl p-3.5 sm:p-4 flex items-center justify-between shadow-md gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-400 shrink-0" />
                  <span className="text-xs font-bold text-white truncate">
                    {formatNumber(leadsCount, i18n.language)} {t('nav.leads', 'New Enquiries')}
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-slate-400 pl-4.5 truncate">
                  {kpis?.conversion_rate ?? 0}% conversion rate
                </p>
              </div>
              <Link
                to="/leads"
                className="px-3 py-1.5 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 text-xs font-bold transition-colors shrink-0 min-h-[36px] flex items-center justify-center"
              >
                {t('leads.follow_up', 'Follow Up')}
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* QUESTION 3: WHAT DO YOU WANT TO DO NEXT? (तुम्हाला काय करायचे आहे?) */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Zap className="w-4 h-4 text-emerald-400" />
          <span>{t('dashboard.quick_next_actions', 'What do you want to do next?')}</span>
        </h2>

        {/* 3 columns on mobile, 3 on sm, 6 on lg -> 2 clean rows of 3 buttons on phones */}
        <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
          <Link
            to="/members?action=new"
            className="p-2.5 sm:p-3.5 bg-[#0f172a] hover:bg-slate-800/80 border border-slate-800 hover:border-emerald-500/40 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center text-center space-y-1.5 sm:space-y-2 group transition-all shadow-md cursor-pointer min-h-[85px] sm:min-h-[105px]"
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/10 group-hover:bg-emerald-500/20 text-emerald-400 flex items-center justify-center transition-colors shrink-0">
              <UserPlus className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="text-[11px] sm:text-xs font-bold text-white group-hover:text-emerald-400 transition-colors line-clamp-1">
              {t('quickActions.add_member', 'Add Member')}
            </span>
          </Link>

          <Link
            to="/attendance"
            className="p-2.5 sm:p-3.5 bg-[#0f172a] hover:bg-slate-800/80 border border-slate-800 hover:border-sky-500/40 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center text-center space-y-1.5 sm:space-y-2 group transition-all shadow-md cursor-pointer min-h-[85px] sm:min-h-[105px]"
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-sky-500/10 group-hover:bg-sky-500/20 text-sky-400 flex items-center justify-center transition-colors shrink-0">
              <CalendarCheck className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="text-[11px] sm:text-xs font-bold text-white group-hover:text-sky-400 transition-colors line-clamp-1">
              {t('attendance.check_in', 'Mark Attendance')}
            </span>
          </Link>

          <Link
            to="/payments?action=new"
            className="p-2.5 sm:p-3.5 bg-[#0f172a] hover:bg-slate-800/80 border border-slate-800 hover:border-amber-500/40 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center text-center space-y-1.5 sm:space-y-2 group transition-all shadow-md cursor-pointer min-h-[85px] sm:min-h-[105px]"
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-amber-500/10 group-hover:bg-amber-500/20 text-amber-400 flex items-center justify-center transition-colors shrink-0">
              <Receipt className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="text-[11px] sm:text-xs font-bold text-white group-hover:text-amber-400 transition-colors line-clamp-1">
              {t('members.collect_due', 'Collect Fee')}
            </span>
          </Link>

          <Link
            to="/pos"
            className="p-2.5 sm:p-3.5 bg-[#0f172a] hover:bg-slate-800/80 border border-slate-800 hover:border-purple-500/40 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center text-center space-y-1.5 sm:space-y-2 group transition-all shadow-md cursor-pointer min-h-[85px] sm:min-h-[105px]"
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-purple-500/10 group-hover:bg-purple-500/20 text-purple-400 flex items-center justify-center transition-colors shrink-0">
              <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="text-[11px] sm:text-xs font-bold text-white group-hover:text-purple-400 transition-colors line-clamp-1">
              {t('nav.pos', 'Store POS')}
            </span>
          </Link>

          <Link
            to="/expenses"
            className="p-2.5 sm:p-3.5 bg-[#0f172a] hover:bg-slate-800/80 border border-slate-800 hover:border-rose-500/40 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center text-center space-y-1.5 sm:space-y-2 group transition-all shadow-md cursor-pointer min-h-[85px] sm:min-h-[105px]"
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-rose-500/10 group-hover:bg-rose-500/20 text-rose-400 flex items-center justify-center transition-colors shrink-0">
              <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="text-[11px] sm:text-xs font-bold text-white group-hover:text-rose-400 transition-colors line-clamp-1">
              {t('quickActions.add_expense', 'Log Expense')}
            </span>
          </Link>

          <Link
            to="/whatsapp"
            className="p-2.5 sm:p-3.5 bg-[#0f172a] hover:bg-slate-800/80 border border-slate-800 hover:border-emerald-500/40 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center text-center space-y-1.5 sm:space-y-2 group transition-all shadow-md cursor-pointer min-h-[85px] sm:min-h-[105px]"
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/10 group-hover:bg-emerald-500/20 text-emerald-400 flex items-center justify-center transition-colors shrink-0">
              <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="text-[11px] sm:text-xs font-bold text-white group-hover:text-emerald-400 transition-colors line-clamp-1">
              {t('nav.whatsapp', 'WhatsApp')}
            </span>
          </Link>
        </div>
      </div>

      {/* Financial Formula Breakdown Card (Income & Expense Report) */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Coins className="w-4 h-4 text-emerald-400" />
              <span>{t('dashboard.operating_profit', 'Operating Profit Breakdown')}</span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Formula: ({t('dashboard.monthly_collections', 'Collections')} + {t('dashboard.supplement_sales', 'POS Profit')}) − {t('dashboard.monthly_expenses', 'Expenses')} = {t('dashboard.operating_profit', 'Operating Profit')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          {/* Box 1: Fee Collections */}
          <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400">
              1. {t('dashboard.monthly_collections', 'Fee Collections')}
            </span>
            <div className="text-lg font-black text-white font-mono">
              {formatCurrency(kpis?.membership_collections ?? 0, i18n.language)}
            </div>
            <span className="text-[10px] text-slate-500">Membership renewals & admissions</span>
          </div>

          {/* Box 2: Supplement Gross Profit */}
          <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-sky-400">
                2. {t('dashboard.supplement_sales', 'Supplement Gross Profit')}
              </span>
              <span className="text-[10px] font-bold text-emerald-400 font-mono">
                {kpis?.supplement_gross_margin_percent ?? 0}%
              </span>
            </div>
            <div className="text-lg font-black text-white font-mono">
              {formatCurrency(kpis?.supplement_gross_profit ?? 0, i18n.language)}
            </div>
            <span className="text-[10px] text-slate-500">
              Sales: {formatCurrency(kpis?.supplement_revenue ?? 0, i18n.language)} − Cost: {formatCurrency(kpis?.supplement_cogs ?? 0, i18n.language)}
            </span>
          </div>

          {/* Box 3: Total Expenses */}
          <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-rose-400">
              3. {t('dashboard.monthly_expenses', 'Operating Expenses')}
            </span>
            <div className="text-lg font-black text-rose-400 font-mono">
              − {formatCurrency(kpis?.total_expenses ?? 0, i18n.language)}
            </div>
            <span className="text-[10px] text-slate-500">Rent, electricity, salaries, equipment</span>
          </div>

          {/* Box 4: Resulting Operating Profit */}
          <div className="bg-emerald-950/20 p-3.5 rounded-xl border border-emerald-500/30 space-y-1">
            <span className="text-[10px] uppercase font-bold text-emerald-400">
              {t('dashboard.operating_profit', 'Net Operating Profit')}
            </span>
            <div className="text-lg font-black text-emerald-400 font-mono">
              = {formatCurrency(kpis?.operating_profit ?? 0, i18n.language)}
            </div>
            <span className="text-[10px] text-emerald-300/80">Realized operating surplus</span>
          </div>
        </div>
      </div>

      {/* Multi-Branch Performance Matrix (If multi-branch exists) */}
      {data?.branch_performance && data.branch_performance.length > 0 && (
        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-400" />
                <span>{t('dashboard.branch_performance', 'Branch Performance Matrix')}</span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Active member distribution, collections, supplement revenue, and profit per location
              </p>
            </div>
          </div>

          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left text-xs min-w-[550px] md:min-w-0">
              <thead className="bg-slate-900/60 text-slate-400 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3">{t('dashboard.col_branch', 'Branch')}</th>
                  <th className="p-3">{t('dashboard.col_active_members', 'Active Members')}</th>
                  <th className="p-3">{t('dashboard.col_collections', 'Collections')}</th>
                  <th className="p-3">{t('dashboard.col_supplements', 'Store Sales')}</th>
                  <th className="p-3">{t('dashboard.col_expenses', 'Expenses')}</th>
                  <th className="p-3 text-right">{t('dashboard.col_profit', 'Operating Profit')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {data.branch_performance.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-3 font-semibold text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span>{b.name}</span>
                      {b.code && (
                        <span className="text-[10px] font-mono bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">
                          {b.code}
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-mono">
                      {formatNumber(b.active_members, i18n.language)}
                    </td>
                    <td className="p-3 font-mono text-emerald-400">
                      {formatCurrency(b.collections, i18n.language)}
                    </td>
                    <td className="p-3 font-mono">
                      {formatCurrency(b.supplement_sales, i18n.language)}
                    </td>
                    <td className="p-3 font-mono text-rose-400">
                      {formatCurrency(b.expenses, i18n.language)}
                    </td>
                    <td className="p-3 font-mono text-right font-bold text-emerald-400">
                      {formatCurrency(b.operating_profit, i18n.language)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
