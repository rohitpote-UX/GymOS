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
      const params: Record<string, any> = { period };
      if (period === 'custom') {
        params.from = customFrom;
        params.to = customTo;
      }
      if (activeBranchId) {
        params.branch_id = activeBranchId;
      }
      const res = await api.get('/owner-dashboard', { params });
      setData(res.data);
    } catch (err: any) {
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 pb-2 border-b border-[#E8E8E8] dark:border-[#303030]">
        <div>
          <div className="flex items-center gap-2.5 sm:gap-3">
            <h1 className="text-xl md:text-2xl font-black text-[#171717] dark:text-white tracking-tight flex items-center gap-2">
              <span>{t('dashboard.title', 'Gym Dashboard')}</span>
              {activeBranch && (
                <span className="text-[10px] sm:text-xs px-2 sm:px-2.5 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-[#E8E8E8] dark:border-[#303030] text-[#D92332] dark:text-[#F02D3A] font-semibold truncate max-w-[140px] sm:max-w-none">
                  {activeBranch.name}
                </span>
              )}
            </h1>
            <span className="text-[10px] px-2 sm:px-2.5 py-0.5 rounded-full bg-[#D92332]/10 text-[#D92332] dark:text-[#F02D3A] font-bold border border-[#D92332]/20 dark:border-[#F02D3A]/20 shrink-0">
              {t('common.live_badge', 'Live')}
            </span>
          </div>
          <p className="text-xs text-[#707070] dark:text-[#A3A3A3] mt-0.5">
            {t('dashboard.subtitle', "Today's performance, actions needed, and next steps")}
          </p>
        </div>

        {/* Quick Action Navigation Buttons */}
        <div className="grid grid-cols-3 gap-1.5 w-full md:w-auto md:flex md:items-center md:gap-2">
          <Link
            to="/members?action=new"
            className="px-2 sm:px-3.5 py-2 rounded-xl bg-[#D92332] hover:bg-[#B91C2B] dark:bg-[#F02D3A] dark:hover:bg-[#FF4652] text-white text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1 sm:gap-1.5 transition-colors shadow-lg shadow-red-600/30 cursor-pointer min-h-[44px] text-center"
          >
            <UserPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate">{t('quickActions.add_member', 'Add Member')}</span>
          </Link>
          <Link
            to="/attendance"
            className="px-2 sm:px-3 py-2 rounded-xl bg-white dark:bg-[#1C1C1C] hover:bg-neutral-100 dark:hover:bg-neutral-800 text-[#171717] dark:text-slate-200 text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1 sm:gap-1.5 transition-colors border border-[#E8E8E8] dark:border-[#303030] cursor-pointer min-h-[44px] text-center"
          >
            <CalendarCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#D92332] dark:text-[#F02D3A] shrink-0" />
            <span className="truncate">{t('common.attendance', 'Attendance')}</span>
          </Link>
          <Link
            to="/payments?action=new"
            className="px-2 sm:px-3 py-2 rounded-xl bg-white dark:bg-[#1C1C1C] hover:bg-neutral-100 dark:hover:bg-neutral-800 text-[#171717] dark:text-slate-200 text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1 sm:gap-1.5 transition-colors border border-[#E8E8E8] dark:border-[#303030] cursor-pointer min-h-[44px] text-center"
          >
            <Receipt className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#D92332] dark:text-[#F02D3A] shrink-0" />
            <span className="truncate">{t('members.collect_due', 'Collect Fee')}</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Guided Onboarding Checklist */}
      {showSetupGuide && (
        <div className="bg-gradient-to-r from-red-500/5 via-neutral-100/60 to-neutral-100/60 dark:from-red-950/25 dark:via-[#1C1C1C] dark:to-[#1C1C1C] border border-[#D92332]/25 dark:border-[#F02D3A]/25 rounded-2xl p-3.5 sm:p-5 relative shadow-md">
          <div className="flex items-start justify-between gap-3 mb-2 sm:mb-3">
            <div className="flex items-center gap-2 sm:gap-2.5">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#D92332]/10 dark:bg-[#F02D3A]/15 text-[#D92332] dark:text-[#F02D3A] flex items-center justify-center font-bold shrink-0">
                <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-[#171717] dark:text-white">
                  {t('dashboard.setup_checklist_title', 'Quick Start: Set Up Your Gym')}
                </h3>
                <p className="text-[10px] sm:text-xs text-[#707070] dark:text-[#A3A3A3] mt-0.5 line-clamp-1 sm:line-clamp-none">
                  {t('dashboard.setup_checklist_sub', 'Follow these simple steps to start running your gym operations effortlessly')}
                </p>
              </div>
            </div>
            <button
              onClick={dismissSetupGuide}
              className="text-[#707070] dark:text-[#A3A3A3] hover:text-[#171717] dark:hover:text-white p-1 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors shrink-0"
              title={t('dashboard.dismiss_guide', 'Dismiss')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mt-2 sm:mt-4">
            <Link
              to="/plans"
              className="bg-white dark:bg-[#141414] hover:bg-neutral-50 dark:hover:bg-neutral-800/80 border border-[#E8E8E8] dark:border-[#303030] hover:border-[#D92332]/40 dark:hover:border-[#F02D3A]/40 rounded-xl p-2 sm:p-3 transition-all group flex items-start gap-2 sm:gap-2.5 min-h-[44px]"
            >
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-[#D92332]/10 dark:bg-[#F02D3A]/15 text-[#D92332] dark:text-[#F02D3A] flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px] sm:text-xs">
                1
              </div>
              <div className="min-w-0">
                <div className="text-[11px] sm:text-xs font-bold text-[#171717] dark:text-white group-hover:text-[#D92332] dark:group-hover:text-[#F02D3A] transition-colors line-clamp-1 sm:line-clamp-none">
                  {t('dashboard.step_plans', '1. Add Membership Plans')}
                </div>
                <div className="hidden sm:block text-[11px] text-[#707070] dark:text-[#A3A3A3] mt-0.5">
                  {t('dashboard.step_plans_desc', 'Set up Monthly, 3-Month, or Annual fees')}
                </div>
              </div>
            </Link>

            <Link
              to="/staff"
              className="bg-white dark:bg-[#141414] hover:bg-neutral-50 dark:hover:bg-neutral-800/80 border border-[#E8E8E8] dark:border-[#303030] hover:border-[#D92332]/40 dark:hover:border-[#F02D3A]/40 rounded-xl p-2 sm:p-3 transition-all group flex items-start gap-2 sm:gap-2.5 min-h-[44px]"
            >
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-[#D92332]/10 dark:bg-[#F02D3A]/15 text-[#D92332] dark:text-[#F02D3A] flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px] sm:text-xs">
                2
              </div>
              <div className="min-w-0">
                <div className="text-[11px] sm:text-xs font-bold text-[#171717] dark:text-white group-hover:text-[#D92332] dark:group-hover:text-[#F02D3A] transition-colors line-clamp-1 sm:line-clamp-none">
                  {t('dashboard.step_staff', '2. Add Staff & Trainers')}
                </div>
                <div className="hidden sm:block text-[11px] text-[#707070] dark:text-[#A3A3A3] mt-0.5">
                  {t('dashboard.step_staff_desc', 'Give login access to receptionists or coaches')}
                </div>
              </div>
            </Link>

            <Link
              to="/members?action=new"
              className="bg-white dark:bg-[#141414] hover:bg-neutral-50 dark:hover:bg-neutral-800/80 border border-[#E8E8E8] dark:border-[#303030] hover:border-[#D92332]/40 dark:hover:border-[#F02D3A]/40 rounded-xl p-2 sm:p-3 transition-all group flex items-start gap-2 sm:gap-2.5 min-h-[44px]"
            >
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-[#D92332]/10 dark:bg-[#F02D3A]/15 text-[#D92332] dark:text-[#F02D3A] flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px] sm:text-xs">
                3
              </div>
              <div className="min-w-0">
                <div className="text-[11px] sm:text-xs font-bold text-[#171717] dark:text-white group-hover:text-[#D92332] dark:group-hover:text-[#F02D3A] transition-colors line-clamp-1 sm:line-clamp-none">
                  {t('dashboard.step_member', '3. Add First Member')}
                </div>
                <div className="hidden sm:block text-[11px] text-[#707070] dark:text-[#A3A3A3] mt-0.5">
                  {t('dashboard.step_member_desc', 'Register a member with phone number and plan')}
                </div>
              </div>
            </Link>

            <Link
              to="/attendance"
              className="bg-white dark:bg-[#141414] hover:bg-neutral-50 dark:hover:bg-neutral-800/80 border border-[#E8E8E8] dark:border-[#303030] hover:border-[#D92332]/40 dark:hover:border-[#F02D3A]/40 rounded-xl p-2 sm:p-3 transition-all group flex items-start gap-2 sm:gap-2.5 min-h-[44px]"
            >
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-[#D92332]/10 dark:bg-[#F02D3A]/15 text-[#D92332] dark:text-[#F02D3A] flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px] sm:text-xs">
                4
              </div>
              <div className="min-w-0">
                <div className="text-[11px] sm:text-xs font-bold text-[#171717] dark:text-white group-hover:text-[#D92332] dark:group-hover:text-[#F02D3A] transition-colors line-clamp-1 sm:line-clamp-none">
                  {t('dashboard.step_attendance', '4. Daily Attendance')}
                </div>
                <div className="hidden sm:block text-[11px] text-[#707070] dark:text-[#A3A3A3] mt-0.5">
                  {t('dashboard.step_attendance_desc', 'Search name or scan QR pass for attendance')}
                </div>
              </div>
            </Link>
          </div>
        </div>
      )}

      {/* Period Selection Bar */}
      <div className="bg-[#F7F7F7] dark:bg-[#1C1C1C] border border-[#E8E8E8] dark:border-[#303030] p-2.5 sm:p-3 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto no-scrollbar pb-0.5 md:pb-0">
          <span className="text-[10px] sm:text-[11px] text-[#707070] dark:text-[#A3A3A3] uppercase font-bold px-1.5 shrink-0">
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
                  ? 'bg-[#D92332] dark:bg-[#F02D3A] text-white shadow-md shadow-red-600/30'
                  : 'bg-white dark:bg-neutral-900 text-[#707070] dark:text-[#A3A3A3] hover:text-[#171717] dark:hover:text-white border border-[#E8E8E8] dark:border-[#303030]'
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
              className="px-2.5 py-1 bg-white dark:bg-[#141414] border border-[#E8E8E8] dark:border-[#303030] rounded-lg text-[#171717] dark:text-white text-xs"
            />
            <span className="text-[#707070] dark:text-[#A3A3A3]">{t('common.to', 'to')}</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="px-2.5 py-1 bg-white dark:bg-[#141414] border border-[#E8E8E8] dark:border-[#303030] rounded-lg text-[#171717] dark:text-white text-xs"
            />
            <button
              onClick={fetchDashboard}
              className="px-3 py-1 bg-[#D92332] dark:bg-[#F02D3A] text-white font-bold rounded-lg text-xs cursor-pointer min-h-[32px]"
            >
              {t('common.apply', 'Apply')}
            </button>
          </div>
        )}

        <div className="text-[11px] text-[#707070] dark:text-[#A3A3A3] font-mono hidden md:block">
          {data ? `Range: ${data.from} to ${data.to}` : ''}
        </div>
      </div>

      {/* QUESTION 1: HOW IS MY GYM PERFORMING? */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#171717] dark:text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#D92332] dark:text-[#F02D3A]" />
            <span>{t('dashboard.how_is_gym_doing', 'How is your gym performing?')}</span>
          </h2>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 md:gap-4">
          {/* Card 1: Active Members */}
          <div className="bg-[#F7F7F7] dark:bg-[#1C1C1C] border border-[#E8E8E8] dark:border-[#303030] p-3.5 sm:p-4.5 rounded-xl sm:rounded-2xl flex flex-col justify-between hover:border-[#D92332]/30 dark:hover:border-[#F02D3A]/30 transition-colors shadow-sm">
            <div>
              <div className="flex items-center justify-between text-[#707070] dark:text-[#A3A3A3]">
                <span className="text-[10px] sm:text-[11px] uppercase font-bold tracking-wider truncate">
                  {t('dashboard.active_members', 'Active Members')}
                </span>
                <Users className="w-4 h-4 text-[#D92332] dark:text-[#F02D3A] shrink-0 ml-1" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-[#171717] dark:text-white mt-1.5 sm:mt-2 truncate">
                {formatNumber(kpis?.active_members ?? 0, i18n.language)}
                <span className="text-[11px] sm:text-xs text-[#707070] dark:text-[#A3A3A3] font-normal ml-1">
                  / {formatNumber(kpis?.total_members ?? 0, i18n.language)}
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-[#707070] dark:text-[#A3A3A3] mt-1 truncate">
                +{formatNumber(kpis?.new_members ?? 0, i18n.language)} {t('common.new_badge', 'new')} {t('common.this_month', 'this month')}
              </p>
            </div>
            <div className="mt-2.5 sm:mt-3 pt-2 sm:pt-2.5 border-t border-[#E8E8E8] dark:border-[#303030]">
              <Link
                to="/members"
                className="text-xs text-[#D92332] dark:text-[#F02D3A] hover:opacity-80 font-semibold flex items-center gap-1 min-h-[32px]"
              >
                <span>{t('dashboard.view_members', 'View Members')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Card 2: Today's Attendance */}
          <div className="bg-[#F7F7F7] dark:bg-[#1C1C1C] border border-[#E8E8E8] dark:border-[#303030] p-3.5 sm:p-4.5 rounded-xl sm:rounded-2xl flex flex-col justify-between hover:border-[#D92332]/30 dark:hover:border-[#F02D3A]/30 transition-colors shadow-sm">
            <div>
              <div className="flex items-center justify-between text-[#707070] dark:text-[#A3A3A3]">
                <span className="text-[10px] sm:text-[11px] uppercase font-bold tracking-wider truncate">
                  {t('dashboard.today_attendance', "Today's Visits")}
                </span>
                <CalendarCheck className="w-4 h-4 text-sky-500 shrink-0 ml-1" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-[#171717] dark:text-white mt-1.5 sm:mt-2 truncate">
                {formatNumber(kpis?.today_attendance ?? 0, i18n.language)}
              </div>
              <p className="text-[10px] sm:text-[11px] text-[#D92332] dark:text-[#F02D3A] font-semibold flex items-center gap-1 mt-1 truncate">
                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#D92332] dark:bg-[#F02D3A] animate-pulse shrink-0" />
                <span className="truncate">{formatNumber(kpis?.currently_inside ?? 0, i18n.language)} {t('attendance.inside_now', 'on floor now')}</span>
              </p>
            </div>
            <div className="mt-2.5 sm:mt-3 pt-2 sm:pt-2.5 border-t border-[#E8E8E8] dark:border-[#303030]">
              <Link
                to="/attendance"
                className="text-xs text-[#D92332] dark:text-[#F02D3A] hover:opacity-80 font-semibold flex items-center gap-1 min-h-[32px]"
              >
                <span>{t('attendance.check_in', 'Mark Attendance')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Card 3: Fee Collections */}
          <div className="bg-[#F7F7F7] dark:bg-[#1C1C1C] border border-[#E8E8E8] dark:border-[#303030] p-3.5 sm:p-4.5 rounded-xl sm:rounded-2xl flex flex-col justify-between hover:border-[#D92332]/30 dark:hover:border-[#F02D3A]/30 transition-colors shadow-sm">
            <div>
              <div className="flex items-center justify-between text-[#707070] dark:text-[#A3A3A3]">
                <span className="text-[10px] sm:text-[11px] uppercase font-bold tracking-wider truncate">
                  {t('dashboard.fees_collected_today', 'Fees Collected')}
                </span>
                <Receipt className="w-4 h-4 text-[#D92332] dark:text-[#F02D3A] shrink-0 ml-1" />
              </div>
              <div className="text-xl sm:text-3xl font-black text-[#D92332] dark:text-[#F02D3A] mt-1.5 sm:mt-2 font-mono truncate">
                {formatCurrency(kpis?.membership_collections ?? 0, i18n.language)}
              </div>
              <p className="text-[10px] sm:text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 truncate">
                +{data?.growth_trend?.revenue_growth_percent ?? 0}% growth
              </p>
            </div>
            <div className="mt-2.5 sm:mt-3 pt-2 sm:pt-2.5 border-t border-[#E8E8E8] dark:border-[#303030]">
              <Link
                to="/payments?action=new"
                className="text-xs text-[#D92332] dark:text-[#F02D3A] hover:opacity-80 font-semibold flex items-center gap-1 min-h-[32px]"
              >
                <span>{t('members.collect_due', '+ Collect Fee')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Card 4: Pending Fees to Collect */}
          <div className="bg-[#F7F7F7] dark:bg-[#1C1C1C] border border-[#E8E8E8] dark:border-[#303030] p-3.5 sm:p-4.5 rounded-xl sm:rounded-2xl flex flex-col justify-between hover:border-[#D92332]/30 dark:hover:border-[#F02D3A]/30 transition-colors shadow-sm">
            <div>
              <div className="flex items-center justify-between text-[#707070] dark:text-[#A3A3A3]">
                <span className="text-[10px] sm:text-[11px] uppercase font-bold tracking-wider truncate">
                  {t('dashboard.pending_fees_label', 'Pending Fees')}
                </span>
                <Coins className="w-4 h-4 text-amber-500 shrink-0 ml-1" />
              </div>
              <div className="text-xl sm:text-3xl font-black text-amber-500 mt-1.5 sm:mt-2 font-mono truncate">
                {formatCurrency(kpis?.outstanding_dues ?? 0, i18n.language)}
              </div>
              <p className="text-[10px] sm:text-[11px] text-[#707070] dark:text-[#A3A3A3] mt-1 truncate">
                {t('actionCenter.members_owing', 'Members owing balance')}
              </p>
            </div>
            <div className="mt-2.5 sm:mt-3 pt-2 sm:pt-2.5 border-t border-[#E8E8E8] dark:border-[#303030]">
              <Link
                to="/members?has_due=1"
                className="text-xs text-amber-500 hover:text-amber-600 font-semibold flex items-center gap-1 min-h-[32px]"
              >
                <span>{t('dashboard.view_and_collect', 'View & Collect')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* QUESTION 2: WHAT NEEDS MY ATTENTION? */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#171717] dark:text-white flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-500" />
            <span>{t('dashboard.what_needs_attention', 'What needs your attention?')}</span>
          </h2>
          <Link
            to="/action-center"
            className="text-xs text-[#707070] dark:text-[#A3A3A3] hover:text-[#171717] dark:hover:text-white flex items-center gap-1"
          >
            <span>{t('nav.action_center', 'All Actions')}</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {totalAttentionCount === 0 && leadsCount === 0 ? (
          <div className="p-3.5 sm:p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl sm:rounded-2xl flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              {t('dashboard.all_good_no_issues', 'Everything is running smoothly! No urgent actions needed.')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-3">
            {/* Attention Item 1: Memberships Expiring Soon */}
            <div className="bg-[#F7F7F7] dark:bg-[#1C1C1C] border border-amber-500/30 rounded-xl sm:rounded-2xl p-3.5 sm:p-4 flex items-center justify-between shadow-sm gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                  <span className="text-xs font-bold text-[#171717] dark:text-white truncate">
                    {formatNumber(expiringCount, i18n.language)} {t('dashboard.expiring_memberships', 'Memberships Expiring')}
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-[#707070] dark:text-[#A3A3A3] pl-4.5 truncate">
                  {t('actionCenter.need_renewals', 'Memberships ending in next 7 days')}
                </p>
              </div>
              <Link
                to="/action-center?search=expiring"
                className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-300 text-xs font-bold transition-colors shrink-0 min-h-[36px] flex items-center justify-center"
              >
                {t('members.renew_membership', 'Renew')}
              </Link>
            </div>

            {/* Attention Item 2: Pending Fees */}
            <div className="bg-[#F7F7F7] dark:bg-[#1C1C1C] border border-rose-500/30 rounded-xl sm:rounded-2xl p-3.5 sm:p-4 flex items-center justify-between shadow-sm gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                  <span className="text-xs font-bold text-[#171717] dark:text-white truncate">
                    {formatCurrency(kpis?.outstanding_dues ?? 0, i18n.language)} {t('dashboard.pending_fees_label', 'Pending Fees')}
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-[#707070] dark:text-[#A3A3A3] pl-4.5 truncate">
                  {t('actionCenter.members_owing', 'Outstanding gym & supplement dues')}
                </p>
              </div>
              <Link
                to="/members?has_due=1"
                className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-300 text-xs font-bold transition-colors shrink-0 min-h-[36px] flex items-center justify-center"
              >
                {t('members.collect_due', 'Collect')}
              </Link>
            </div>

            {/* Attention Item 3: Prospective Enquiries */}
            <div className="bg-[#F7F7F7] dark:bg-[#1C1C1C] border border-blue-500/30 rounded-xl sm:rounded-2xl p-3.5 sm:p-4 flex items-center justify-between shadow-sm gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                  <span className="text-xs font-bold text-[#171717] dark:text-white truncate">
                    {formatNumber(leadsCount, i18n.language)} {t('nav.leads', 'New Enquiries')}
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-[#707070] dark:text-[#A3A3A3] pl-4.5 truncate">
                  {kpis?.conversion_rate ?? 0}% conversion rate
                </p>
              </div>
              <Link
                to="/leads"
                className="px-3 py-1.5 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 text-blue-600 dark:text-blue-300 text-xs font-bold transition-colors shrink-0 min-h-[36px] flex items-center justify-center"
              >
                {t('leads.follow_up', 'Follow Up')}
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* QUESTION 3: WHAT DO YOU WANT TO DO NEXT? */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-[#171717] dark:text-white flex items-center gap-2">
          <Zap className="w-4 h-4 text-[#D92332] dark:text-[#F02D3A]" />
          <span>{t('dashboard.quick_next_actions', 'What do you want to do next?')}</span>
        </h2>

        {/* 3 columns on mobile, 6 on lg */}
        <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
          <Link
            to="/members?action=new"
            className="p-2.5 sm:p-3.5 bg-[#F7F7F7] dark:bg-[#1C1C1C] hover:bg-white dark:hover:bg-neutral-800 border border-[#E8E8E8] dark:border-[#303030] hover:border-[#D92332]/40 dark:hover:border-[#F02D3A]/40 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center text-center space-y-1.5 sm:space-y-2 group transition-all shadow-sm cursor-pointer min-h-[85px] sm:min-h-[105px]"
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[#D92332]/10 group-hover:bg-[#D92332]/20 text-[#D92332] dark:text-[#F02D3A] flex items-center justify-center transition-colors shrink-0">
              <UserPlus className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="text-[11px] sm:text-xs font-bold text-[#171717] dark:text-white group-hover:text-[#D92332] dark:group-hover:text-[#F02D3A] transition-colors line-clamp-1">
              {t('quickActions.add_member', 'Add Member')}
            </span>
          </Link>

          <Link
            to="/attendance"
            className="p-2.5 sm:p-3.5 bg-[#F7F7F7] dark:bg-[#1C1C1C] hover:bg-white dark:hover:bg-neutral-800 border border-[#E8E8E8] dark:border-[#303030] hover:border-sky-500/40 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center text-center space-y-1.5 sm:space-y-2 group transition-all shadow-sm cursor-pointer min-h-[85px] sm:min-h-[105px]"
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-sky-500/10 group-hover:bg-sky-500/20 text-sky-500 flex items-center justify-center transition-colors shrink-0">
              <CalendarCheck className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="text-[11px] sm:text-xs font-bold text-[#171717] dark:text-white group-hover:text-sky-500 transition-colors line-clamp-1">
              {t('attendance.check_in', 'Mark Attendance')}
            </span>
          </Link>

          <Link
            to="/payments?action=new"
            className="p-2.5 sm:p-3.5 bg-[#F7F7F7] dark:bg-[#1C1C1C] hover:bg-white dark:hover:bg-neutral-800 border border-[#E8E8E8] dark:border-[#303030] hover:border-amber-500/40 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center text-center space-y-1.5 sm:space-y-2 group transition-all shadow-sm cursor-pointer min-h-[85px] sm:min-h-[105px]"
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-amber-500/10 group-hover:bg-amber-500/20 text-amber-500 flex items-center justify-center transition-colors shrink-0">
              <Receipt className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="text-[11px] sm:text-xs font-bold text-[#171717] dark:text-white group-hover:text-amber-500 transition-colors line-clamp-1">
              {t('members.collect_due', 'Collect Fee')}
            </span>
          </Link>

          <Link
            to="/pos"
            className="p-2.5 sm:p-3.5 bg-[#F7F7F7] dark:bg-[#1C1C1C] hover:bg-white dark:hover:bg-neutral-800 border border-[#E8E8E8] dark:border-[#303030] hover:border-purple-500/40 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center text-center space-y-1.5 sm:space-y-2 group transition-all shadow-sm cursor-pointer min-h-[85px] sm:min-h-[105px]"
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-purple-500/10 group-hover:bg-purple-500/20 text-purple-500 flex items-center justify-center transition-colors shrink-0">
              <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="text-[11px] sm:text-xs font-bold text-[#171717] dark:text-white group-hover:text-purple-500 transition-colors line-clamp-1">
              {t('nav.pos', 'Store POS')}
            </span>
          </Link>

          <Link
            to="/expenses"
            className="p-2.5 sm:p-3.5 bg-[#F7F7F7] dark:bg-[#1C1C1C] hover:bg-white dark:hover:bg-neutral-800 border border-[#E8E8E8] dark:border-[#303030] hover:border-rose-500/40 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center text-center space-y-1.5 sm:space-y-2 group transition-all shadow-sm cursor-pointer min-h-[85px] sm:min-h-[105px]"
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-rose-500/10 group-hover:bg-rose-500/20 text-rose-500 flex items-center justify-center transition-colors shrink-0">
              <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="text-[11px] sm:text-xs font-bold text-[#171717] dark:text-white group-hover:text-rose-500 transition-colors line-clamp-1">
              {t('quickActions.add_expense', 'Log Expense')}
            </span>
          </Link>

          <Link
            to="/whatsapp"
            className="p-2.5 sm:p-3.5 bg-[#F7F7F7] dark:bg-[#1C1C1C] hover:bg-white dark:hover:bg-neutral-800 border border-[#E8E8E8] dark:border-[#303030] hover:border-[#D92332]/40 dark:hover:border-[#F02D3A]/40 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center text-center space-y-1.5 sm:space-y-2 group transition-all shadow-sm cursor-pointer min-h-[85px] sm:min-h-[105px]"
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[#D92332]/10 group-hover:bg-[#D92332]/20 text-[#D92332] dark:text-[#F02D3A] flex items-center justify-center transition-colors shrink-0">
              <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="text-[11px] sm:text-xs font-bold text-[#171717] dark:text-white group-hover:text-[#D92332] dark:group-hover:text-[#F02D3A] transition-colors line-clamp-1">
              {t('nav.whatsapp', 'WhatsApp')}
            </span>
          </Link>
        </div>
      </div>

      {/* Financial Formula Breakdown Card */}
      <div className="bg-[#F7F7F7] dark:bg-[#1C1C1C] border border-[#E8E8E8] dark:border-[#303030] rounded-2xl p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-[#E8E8E8] dark:border-[#303030]">
          <div>
            <h3 className="text-sm font-bold text-[#171717] dark:text-white flex items-center gap-2">
              <Coins className="w-4 h-4 text-[#D92332] dark:text-[#F02D3A]" />
              <span>{t('dashboard.operating_profit', 'Operating Profit Breakdown')}</span>
            </h3>
            <p className="text-[11px] text-[#707070] dark:text-[#A3A3A3]">
              Formula: ({t('dashboard.monthly_collections', 'Collections')} + {t('dashboard.supplement_sales', 'POS Profit')}) − {t('dashboard.monthly_expenses', 'Expenses')} = {t('dashboard.operating_profit', 'Operating Profit')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          {/* Box 1: Fee Collections */}
          <div className="bg-white dark:bg-neutral-900/80 p-3.5 rounded-xl border border-[#E8E8E8] dark:border-[#303030] space-y-1">
            <span className="text-[10px] uppercase font-bold text-[#707070] dark:text-[#A3A3A3]">
              1. {t('dashboard.monthly_collections', 'Fee Collections')}
            </span>
            <div className="text-lg font-black text-[#171717] dark:text-white font-mono">
              {formatCurrency(kpis?.membership_collections ?? 0, i18n.language)}
            </div>
            <span className="text-[10px] text-[#707070] dark:text-[#A3A3A3]">Membership renewals & admissions</span>
          </div>

          {/* Box 2: Supplement Gross Profit */}
          <div className="bg-white dark:bg-neutral-900/80 p-3.5 rounded-xl border border-[#E8E8E8] dark:border-[#303030] space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-sky-500">
                2. {t('dashboard.supplement_sales', 'Supplement Gross Profit')}
              </span>
              <span className="text-[10px] font-bold text-emerald-500 font-mono">
                {kpis?.supplement_gross_margin_percent ?? 0}%
              </span>
            </div>
            <div className="text-lg font-black text-[#171717] dark:text-white font-mono">
              {formatCurrency(kpis?.supplement_gross_profit ?? 0, i18n.language)}
            </div>
            <span className="text-[10px] text-[#707070] dark:text-[#A3A3A3]">
              Sales: {formatCurrency(kpis?.supplement_revenue ?? 0, i18n.language)} − Cost: {formatCurrency(kpis?.supplement_cogs ?? 0, i18n.language)}
            </span>
          </div>

          {/* Box 3: Total Expenses */}
          <div className="bg-white dark:bg-neutral-900/80 p-3.5 rounded-xl border border-[#E8E8E8] dark:border-[#303030] space-y-1">
            <span className="text-[10px] uppercase font-bold text-rose-500">
              3. {t('dashboard.monthly_expenses', 'Operating Expenses')}
            </span>
            <div className="text-lg font-black text-rose-500 font-mono">
              − {formatCurrency(kpis?.total_expenses ?? 0, i18n.language)}
            </div>
            <span className="text-[10px] text-[#707070] dark:text-[#A3A3A3]">Rent, electricity, salaries, equipment</span>
          </div>

          {/* Box 4: Resulting Operating Profit */}
          <div className="bg-[#D92332]/10 dark:bg-[#F02D3A]/15 p-3.5 rounded-xl border border-[#D92332]/30 dark:border-[#F02D3A]/30 space-y-1">
            <span className="text-[10px] uppercase font-bold text-[#D92332] dark:text-[#F02D3A]">
              {t('dashboard.operating_profit', 'Net Operating Profit')}
            </span>
            <div className="text-lg font-black text-[#D92332] dark:text-[#F02D3A] font-mono">
              = {formatCurrency(kpis?.operating_profit ?? 0, i18n.language)}
            </div>
            <span className="text-[10px] text-[#707070] dark:text-[#A3A3A3]">Realized operating surplus</span>
          </div>
        </div>
      </div>

      {/* Multi-Branch Performance Matrix */}
      {data?.branch_performance && data.branch_performance.length > 0 && (
        <div className="bg-[#F7F7F7] dark:bg-[#1C1C1C] border border-[#E8E8E8] dark:border-[#303030] rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-[#E8E8E8] dark:border-[#303030]">
            <div>
              <h3 className="text-sm font-bold text-[#171717] dark:text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#D92332] dark:text-[#F02D3A]" />
                <span>{t('dashboard.branch_performance', 'Branch Performance Matrix')}</span>
              </h3>
              <p className="text-[11px] text-[#707070] dark:text-[#A3A3A3]">
                Active member distribution, collections, supplement revenue, and profit per location
              </p>
            </div>
          </div>

          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left text-xs min-w-[550px] md:min-w-0">
              <thead className="bg-neutral-100 dark:bg-neutral-900/60 text-[#707070] dark:text-[#A3A3A3] uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3">{t('dashboard.col_branch', 'Branch')}</th>
                  <th className="p-3">{t('dashboard.col_active_members', 'Active Members')}</th>
                  <th className="p-3">{t('dashboard.col_collections', 'Collections')}</th>
                  <th className="p-3">{t('dashboard.col_supplements', 'Store Sales')}</th>
                  <th className="p-3">{t('dashboard.col_expenses', 'Expenses')}</th>
                  <th className="p-3 text-right">{t('dashboard.col_profit', 'Operating Profit')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E8E8] dark:divide-[#303030] text-[#171717] dark:text-slate-200">
                {data.branch_performance.map((b) => (
                  <tr key={b.id} className="hover:bg-neutral-200/40 dark:hover:bg-neutral-800/30 transition-colors">
                    <td className="p-3 font-semibold text-[#171717] dark:text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#D92332] dark:bg-[#F02D3A]" />
                      <span>{b.name}</span>
                      {b.code && (
                        <span className="text-[10px] font-mono bg-neutral-200 dark:bg-neutral-800 px-1.5 py-0.5 rounded text-[#707070] dark:text-[#A3A3A3]">
                          {b.code}
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-mono">
                      {formatNumber(b.active_members, i18n.language)}
                    </td>
                    <td className="p-3 font-mono text-[#D92332] dark:text-[#F02D3A]">
                      {formatCurrency(b.collections, i18n.language)}
                    </td>
                    <td className="p-3 font-mono">
                      {formatCurrency(b.supplement_sales, i18n.language)}
                    </td>
                    <td className="p-3 font-mono text-rose-500">
                      {formatCurrency(b.expenses, i18n.language)}
                    </td>
                    <td className="p-3 font-mono text-right font-bold text-[#D92332] dark:text-[#F02D3A]">
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
