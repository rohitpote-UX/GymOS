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
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Top Banner / Welcome & Quick Primary Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E9ECEF] dark:border-[#2E2E33]">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="text-gym-title font-display font-bold text-[#171717] dark:text-[#EDEDED] flex items-center gap-2">
              <span>{t('dashboard.title', 'Gym Dashboard')}</span>
            </h1>
            {activeBranch && (
              <span className="badge-gym-neutral truncate max-w-[160px] sm:max-w-none">
                {activeBranch.name}
              </span>
            )}
            <span className="badge-gym-red shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D92332] dark:bg-[#F02D3A] animate-pulse" />
              <span>{t('common.live_badge', 'Live')}</span>
            </span>
          </div>
          <p className="text-gym-sub">
            {t('dashboard.subtitle', "Today's performance, actions needed, and next steps")}
          </p>
        </div>

        {/* Quick Action Navigation Buttons (Mobile-first stacked & prominent, Desktop flex) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
          <Link
            to="/members?action=new"
            className="btn-gym-primary flex-1 sm:flex-initial text-center text-xs sm:text-sm font-bold shadow-gym-red"
          >
            <UserPlus className="w-4 h-4 shrink-0" />
            <span>{t('quickActions.add_member', 'Add Member')}</span>
          </Link>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <Link
              to="/attendance"
              className="btn-gym-secondary text-xs sm:text-sm font-semibold text-center"
            >
              <CalendarCheck className="w-4 h-4 text-[#D92332] dark:text-[#F02D3A] shrink-0" />
              <span>{t('common.attendance', 'Attendance')}</span>
            </Link>
            <Link
              to="/payments?action=new"
              className="btn-gym-secondary text-xs sm:text-sm font-semibold text-center"
            >
              <Receipt className="w-4 h-4 text-[#D92332] dark:text-[#F02D3A] shrink-0" />
              <span>{t('members.collect_due', 'Collect Fee')}</span>
            </Link>
          </div>
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
        <div className="card-gym bg-gradient-to-r from-red-500/5 via-transparent to-transparent border-[#D92332]/25 dark:border-[#F02D3A]/25 relative">
          <div className="flex items-start justify-between gap-3 mb-3 sm:mb-4">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gym-red-subtle text-gym-red flex items-center justify-center font-bold shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-gym-card-title text-[#171717] dark:text-[#EDEDED]">
                  {t('dashboard.setup_checklist_title', 'Quick Start: Set Up Your Gym')}
                </h3>
                <p className="text-gym-sub mt-0.5">
                  {t('dashboard.setup_checklist_sub', 'Follow these simple steps to start running your gym operations effortlessly')}
                </p>
              </div>
            </div>
            <button
              onClick={dismissSetupGuide}
              className="text-gym-muted hover:text-gym-primary p-1.5 rounded-lg hover:bg-neutral-200/60 dark:hover:bg-neutral-800/60 transition-colors shrink-0 cursor-pointer"
              title={t('dashboard.dismiss_guide', 'Dismiss')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            {[
              { num: '1', titleKey: 'dashboard.step_plans', defaultTitle: '1. Add Membership Plans', descKey: 'dashboard.step_plans_desc', defaultDesc: 'Set up Monthly, 3-Month, or Annual fees', to: '/plans' },
              { num: '2', titleKey: 'dashboard.step_staff', defaultTitle: '2. Add Staff & Trainers', descKey: 'dashboard.step_staff_desc', defaultDesc: 'Give login access to receptionists or coaches', to: '/staff' },
              { num: '3', titleKey: 'dashboard.step_member', defaultTitle: '3. Add First Member', descKey: 'dashboard.step_member_desc', defaultDesc: 'Register a member with phone number and plan', to: '/members?action=new' },
              { num: '4', titleKey: 'dashboard.step_attendance', defaultTitle: '4. Daily Attendance', descKey: 'dashboard.step_attendance_desc', defaultDesc: 'Search name or scan QR pass for attendance', to: '/attendance' },
            ].map((step) => (
              <Link
                key={step.num}
                to={step.to}
                className="bg-white dark:bg-[#141416] hover:bg-neutral-50 dark:hover:bg-neutral-800/60 border border-[#E9ECEF] dark:border-[#2E2E33] hover:border-gym-red/40 rounded-xl p-3 sm:p-3.5 transition-all group flex items-start gap-3 min-h-[48px]"
              >
                <div className="w-6 h-6 rounded-lg bg-gym-red-subtle text-gym-red flex items-center justify-center shrink-0 font-display font-bold text-xs">
                  {step.num}
                </div>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-semibold text-[#171717] dark:text-[#EDEDED] group-hover:text-gym-red transition-colors">
                    {t(step.titleKey, step.defaultTitle)}
                  </div>
                  <div className="text-gym-sub text-[11px] sm:text-xs mt-0.5 line-clamp-1 sm:line-clamp-2">
                    {t(step.descKey, step.defaultDesc)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Period Selection Bar */}
      <div className="card-gym p-3 sm:p-3.5 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto no-scrollbar pb-1 md:pb-0">
          <span className="text-gym-micro shrink-0 px-1">
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
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 min-h-[38px] flex items-center justify-center ${
                period === btn.id
                  ? 'bg-gym-red text-white shadow-gym-red'
                  : 'bg-white dark:bg-[#141416] text-[#707070] dark:text-[#A1A1AA] hover:text-[#171717] dark:hover:text-white border border-[#E9ECEF] dark:border-[#2E2E33]'
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
              className="px-2.5 py-1 bg-white dark:bg-[#141414] border border-[#E9ECEF] dark:border-[#2E2E33] rounded-lg text-gym-primary text-xs"
            />
            <span className="text-gym-muted">{t('common.to', 'to')}</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="px-2.5 py-1 bg-white dark:bg-[#141414] border border-[#E9ECEF] dark:border-[#2E2E33] rounded-lg text-gym-primary text-xs"
            />
            <button
              onClick={fetchDashboard}
              className="btn-gym-primary px-3 py-1 text-xs min-h-[32px]"
            >
              {t('common.apply', 'Apply')}
            </button>
          </div>
        )}

        <div className="text-gym-sub text-[11px] font-mono hidden md:block">
          {data ? `Range: ${data.from} to ${data.to}` : ''}
        </div>
      </div>

      {/* QUESTION 1: HOW IS MY GYM PERFORMING? */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-gym-section text-gym-primary flex items-center gap-2">
            <Activity className="w-5 h-5 text-gym-red shrink-0" />
            <span>{t('dashboard.how_is_gym_doing', 'How is your gym performing?')}</span>
          </h2>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
          {/* Card 1: Active Members */}
          <div className="card-gym flex flex-col justify-between hover:border-gym-red/40 transition-all">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-gym-micro truncate">
                  {t('dashboard.active_members', 'Active Members')}
                </span>
                <Users className="w-4 h-4 text-gym-red shrink-0 ml-1" />
              </div>
              <div className="text-gym-hero text-[#171717] dark:text-[#EDEDED] mt-2 truncate flex items-baseline">
                <span>{formatNumber(kpis?.active_members ?? 0, i18n.language)}</span>
                <span className="text-xs sm:text-sm font-sans font-normal text-gym-muted ml-1.5">
                  / {formatNumber(kpis?.total_members ?? 0, i18n.language)}
                </span>
              </div>
              <p className="text-gym-sub text-[11px] sm:text-xs mt-1 truncate">
                +{formatNumber(kpis?.new_members ?? 0, i18n.language)} {t('common.new_badge', 'new')} {t('common.this_month', 'this month')}
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-[#E9ECEF] dark:border-[#2E2E33]">
              <Link
                to="/members"
                className="text-xs text-gym-red hover:opacity-80 font-semibold flex items-center gap-1 min-h-[32px]"
              >
                <span>{t('dashboard.view_members', 'View Members')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Card 2: Today's Attendance */}
          <div className="card-gym flex flex-col justify-between hover:border-gym-red/40 transition-all">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-gym-micro truncate">
                  {t('dashboard.today_attendance', "Today's Visits")}
                </span>
                <CalendarCheck className="w-4 h-4 text-sky-500 shrink-0 ml-1" />
              </div>
              <div className="text-gym-hero text-[#171717] dark:text-[#EDEDED] mt-2 truncate">
                {formatNumber(kpis?.today_attendance ?? 0, i18n.language)}
              </div>
              <p className="text-gym-red font-semibold text-[11px] sm:text-xs flex items-center gap-1.5 mt-1 truncate">
                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-gym-red animate-pulse shrink-0" />
                <span className="truncate">{formatNumber(kpis?.currently_inside ?? 0, i18n.language)} {t('attendance.inside_now', 'on floor now')}</span>
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-[#E9ECEF] dark:border-[#2E2E33]">
              <Link
                to="/attendance"
                className="text-xs text-gym-red hover:opacity-80 font-semibold flex items-center gap-1 min-h-[32px]"
              >
                <span>{t('attendance.check_in', 'Mark Attendance')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Card 3: Fee Collections */}
          <div className="card-gym flex flex-col justify-between hover:border-gym-red/40 transition-all">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-gym-micro truncate">
                  {t('dashboard.fees_collected_today', 'Fees Collected')}
                </span>
                <Receipt className="w-4 h-4 text-gym-red shrink-0 ml-1" />
              </div>
              <div className="text-gym-hero text-gym-red mt-2 font-mono truncate">
                {formatCurrency(kpis?.membership_collections ?? 0, i18n.language)}
              </div>
              <p className="text-[11px] sm:text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-1 truncate">
                +{data?.growth_trend?.revenue_growth_percent ?? 0}% growth
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-[#E9ECEF] dark:border-[#2E2E33]">
              <Link
                to="/payments?action=new"
                className="text-xs text-gym-red hover:opacity-80 font-semibold flex items-center gap-1 min-h-[32px]"
              >
                <span>{t('members.collect_due', '+ Collect Fee')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Card 4: Pending Fees to Collect */}
          <div className="card-gym flex flex-col justify-between hover:border-amber-500/40 transition-all">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-gym-micro truncate">
                  {t('dashboard.pending_fees_label', 'Pending Fees')}
                </span>
                <Coins className="w-4 h-4 text-amber-500 shrink-0 ml-1" />
              </div>
              <div className="text-gym-hero text-amber-500 mt-2 font-mono truncate">
                {formatCurrency(kpis?.outstanding_dues ?? 0, i18n.language)}
              </div>
              <p className="text-gym-sub text-[11px] sm:text-xs mt-1 truncate">
                {t('actionCenter.members_owing', 'Members owing balance')}
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-[#E9ECEF] dark:border-[#2E2E33]">
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
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-gym-section text-gym-primary flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0" />
            <span>{t('dashboard.what_needs_attention', 'What needs your attention?')}</span>
          </h2>
          <Link
            to="/action-center"
            className="text-xs text-gym-sub hover:text-gym-primary flex items-center gap-1"
          >
            <span>{t('nav.action_center', 'All Actions')}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {totalAttentionCount === 0 && leadsCount === 0 ? (
          <div className="card-gym bg-emerald-500/10 border-emerald-500/25 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            <p className="text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 font-medium">
              {t('dashboard.all_good_no_issues', 'Everything is running smoothly! No urgent actions needed.')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
            {/* Attention Item 1: Memberships Expiring Soon */}
            <div className="card-gym border-amber-500/30 flex items-center justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                  <span className="text-xs sm:text-sm font-bold text-[#171717] dark:text-[#EDEDED] truncate">
                    {formatNumber(expiringCount, i18n.language)} {t('dashboard.expiring_memberships', 'Memberships Expiring')}
                  </span>
                </div>
                <p className="text-gym-sub text-[11px] sm:text-xs pl-4.5 truncate">
                  {t('actionCenter.need_renewals', 'Memberships ending in next 7 days')}
                </p>
              </div>
              <Link
                to="/action-center?search=expiring"
                className="px-3.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-300 text-xs font-bold transition-colors shrink-0 min-h-[36px] flex items-center justify-center cursor-pointer"
              >
                {t('members.renew_membership', 'Renew')}
              </Link>
            </div>

            {/* Attention Item 2: Pending Fees */}
            <div className="card-gym border-rose-500/30 flex items-center justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                  <span className="text-xs sm:text-sm font-bold text-[#171717] dark:text-[#EDEDED] truncate">
                    {formatCurrency(kpis?.outstanding_dues ?? 0, i18n.language)} {t('dashboard.pending_fees_label', 'Pending Fees')}
                  </span>
                </div>
                <p className="text-gym-sub text-[11px] sm:text-xs pl-4.5 truncate">
                  {t('actionCenter.members_owing', 'Outstanding gym & supplement dues')}
                </p>
              </div>
              <Link
                to="/members?has_due=1"
                className="px-3.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-300 text-xs font-bold transition-colors shrink-0 min-h-[36px] flex items-center justify-center cursor-pointer"
              >
                {t('members.collect_due', 'Collect')}
              </Link>
            </div>

            {/* Attention Item 3: Prospective Enquiries */}
            <div className="card-gym border-blue-500/30 flex items-center justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                  <span className="text-xs sm:text-sm font-bold text-[#171717] dark:text-[#EDEDED] truncate">
                    {formatNumber(leadsCount, i18n.language)} {t('nav.leads', 'New Enquiries')}
                  </span>
                </div>
                <p className="text-gym-sub text-[11px] sm:text-xs pl-4.5 truncate">
                  {kpis?.conversion_rate ?? 0}% conversion rate
                </p>
              </div>
              <Link
                to="/leads"
                className="px-3.5 py-1.5 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 text-blue-600 dark:text-blue-300 text-xs font-bold transition-colors shrink-0 min-h-[36px] flex items-center justify-center cursor-pointer"
              >
                {t('leads.follow_up', 'Follow Up')}
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* QUESTION 3: WHAT DO YOU WANT TO DO NEXT? */}
      <div className="space-y-4">
        <h2 className="text-gym-section text-gym-primary flex items-center gap-2">
          <Zap className="w-5 h-5 text-gym-red shrink-0" />
          <span>{t('dashboard.quick_next_actions', 'What do you want to do next?')}</span>
        </h2>

        {/* 3 columns on mobile, 6 on desktop */}
        <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3.5">
          <Link
            to="/members?action=new"
            className="card-gym-interactive p-3 sm:p-4 flex flex-col items-center justify-center text-center space-y-2 group min-h-[96px] sm:min-h-[112px]"
          >
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-gym-red-subtle group-hover:bg-[#D92332]/20 text-gym-red flex items-center justify-center transition-colors shrink-0">
              <UserPlus className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="text-xs font-bold text-[#171717] dark:text-[#EDEDED] group-hover:text-gym-red transition-colors line-clamp-1">
              {t('quickActions.add_member', 'Add Member')}
            </span>
          </Link>

          <Link
            to="/attendance"
            className="card-gym-interactive p-3 sm:p-4 flex flex-col items-center justify-center text-center space-y-2 group min-h-[96px] sm:min-h-[112px]"
          >
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-sky-500/10 group-hover:bg-sky-500/20 text-sky-500 flex items-center justify-center transition-colors shrink-0">
              <CalendarCheck className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="text-xs font-bold text-[#171717] dark:text-[#EDEDED] group-hover:text-sky-500 transition-colors line-clamp-1">
              {t('attendance.check_in', 'Mark Attendance')}
            </span>
          </Link>

          <Link
            to="/payments?action=new"
            className="card-gym-interactive p-3 sm:p-4 flex flex-col items-center justify-center text-center space-y-2 group min-h-[96px] sm:min-h-[112px]"
          >
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-amber-500/10 group-hover:bg-amber-500/20 text-amber-500 flex items-center justify-center transition-colors shrink-0">
              <Receipt className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="text-xs font-bold text-[#171717] dark:text-[#EDEDED] group-hover:text-amber-500 transition-colors line-clamp-1">
              {t('members.collect_due', 'Collect Fee')}
            </span>
          </Link>

          <Link
            to="/pos"
            className="card-gym-interactive p-3 sm:p-4 flex flex-col items-center justify-center text-center space-y-2 group min-h-[96px] sm:min-h-[112px]"
          >
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-purple-500/10 group-hover:bg-purple-500/20 text-purple-500 flex items-center justify-center transition-colors shrink-0">
              <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="text-xs font-bold text-[#171717] dark:text-[#EDEDED] group-hover:text-purple-500 transition-colors line-clamp-1">
              {t('nav.pos', 'Store POS')}
            </span>
          </Link>

          <Link
            to="/expenses"
            className="card-gym-interactive p-3 sm:p-4 flex flex-col items-center justify-center text-center space-y-2 group min-h-[96px] sm:min-h-[112px]"
          >
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-rose-500/10 group-hover:bg-rose-500/20 text-rose-500 flex items-center justify-center transition-colors shrink-0">
              <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="text-xs font-bold text-[#171717] dark:text-[#EDEDED] group-hover:text-rose-500 transition-colors line-clamp-1">
              {t('quickActions.add_expense', 'Log Expense')}
            </span>
          </Link>

          <Link
            to="/whatsapp"
            className="card-gym-interactive p-3 sm:p-4 flex flex-col items-center justify-center text-center space-y-2 group min-h-[96px] sm:min-h-[112px]"
          >
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-gym-red-subtle group-hover:bg-[#D92332]/20 text-gym-red flex items-center justify-center transition-colors shrink-0">
              <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="text-xs font-bold text-[#171717] dark:text-[#EDEDED] group-hover:text-gym-red transition-colors line-clamp-1">
              {t('nav.whatsapp', 'WhatsApp')}
            </span>
          </Link>
        </div>
      </div>

      {/* Financial Formula Breakdown Card */}
      <div className="card-gym space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E9ECEF] dark:border-[#2E2E33]">
          <div>
            <h3 className="text-gym-card-title text-[#171717] dark:text-[#EDEDED] flex items-center gap-2">
              <Coins className="w-4 h-4 text-gym-red" />
              <span>{t('dashboard.operating_profit', 'Operating Profit Breakdown')}</span>
            </h3>
            <p className="text-gym-sub text-[11px] sm:text-xs">
              Formula: ({t('dashboard.monthly_collections', 'Collections')} + {t('dashboard.supplement_sales', 'POS Profit')}) − {t('dashboard.monthly_expenses', 'Expenses')} = {t('dashboard.operating_profit', 'Operating Profit')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-4 text-xs">
          {/* Box 1: Fee Collections */}
          <div className="bg-white dark:bg-[#141416] p-4 rounded-xl border border-[#E9ECEF] dark:border-[#2E2E33] space-y-1">
            <span className="text-gym-micro">
              1. {t('dashboard.monthly_collections', 'Fee Collections')}
            </span>
            <div className="text-xl font-bold font-display text-[#171717] dark:text-[#EDEDED] font-mono">
              {formatCurrency(kpis?.membership_collections ?? 0, i18n.language)}
            </div>
            <span className="text-gym-sub text-[11px]">Membership renewals & admissions</span>
          </div>

          {/* Box 2: Supplement Gross Profit */}
          <div className="bg-white dark:bg-[#141416] p-4 rounded-xl border border-[#E9ECEF] dark:border-[#2E2E33] space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-gym-micro text-sky-500">
                2. {t('dashboard.supplement_sales', 'Supplement Gross Profit')}
              </span>
              <span className="text-[11px] font-bold text-emerald-500 font-mono">
                {kpis?.supplement_gross_margin_percent ?? 0}%
              </span>
            </div>
            <div className="text-xl font-bold font-display text-[#171717] dark:text-[#EDEDED] font-mono">
              {formatCurrency(kpis?.supplement_gross_profit ?? 0, i18n.language)}
            </div>
            <span className="text-gym-sub text-[11px]">
              Sales: {formatCurrency(kpis?.supplement_revenue ?? 0, i18n.language)} − Cost: {formatCurrency(kpis?.supplement_cogs ?? 0, i18n.language)}
            </span>
          </div>

          {/* Box 3: Total Expenses */}
          <div className="bg-white dark:bg-[#141416] p-4 rounded-xl border border-[#E9ECEF] dark:border-[#2E2E33] space-y-1">
            <span className="text-gym-micro text-rose-500">
              3. {t('dashboard.monthly_expenses', 'Operating Expenses')}
            </span>
            <div className="text-xl font-bold font-display text-rose-500 font-mono">
              − {formatCurrency(kpis?.total_expenses ?? 0, i18n.language)}
            </div>
            <span className="text-gym-sub text-[11px]">Rent, electricity, salaries, equipment</span>
          </div>

          {/* Box 4: Resulting Operating Profit */}
          <div className="bg-gym-red-subtle p-4 rounded-xl border border-gym-red/30 space-y-1">
            <span className="text-gym-micro text-gym-red">
              {t('dashboard.operating_profit', 'Net Operating Profit')}
            </span>
            <div className="text-xl font-bold font-display text-gym-red font-mono">
              = {formatCurrency(kpis?.operating_profit ?? 0, i18n.language)}
            </div>
            <span className="text-gym-sub text-[11px]">Realized operating surplus</span>
          </div>
        </div>
      </div>

      {/* Multi-Branch Performance Matrix */}
      {data?.branch_performance && data.branch_performance.length > 0 && (
        <div className="card-gym space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E9ECEF] dark:border-[#2E2E33]">
            <div>
              <h3 className="text-gym-card-title text-[#171717] dark:text-[#EDEDED] flex items-center gap-2">
                <Building2 className="w-4 h-4 text-gym-red" />
                <span>{t('dashboard.branch_performance', 'Branch Performance Matrix')}</span>
              </h3>
              <p className="text-gym-sub text-[11px] sm:text-xs">
                Active member distribution, collections, supplement revenue, and profit per location
              </p>
            </div>
          </div>

          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left text-xs min-w-[550px] md:min-w-0">
              <thead className="bg-neutral-100 dark:bg-neutral-900/60 text-[#707070] dark:text-[#A1A1AA] uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3.5">{t('dashboard.col_branch', 'Branch')}</th>
                  <th className="p-3.5">{t('dashboard.col_active_members', 'Active Members')}</th>
                  <th className="p-3.5">{t('dashboard.col_collections', 'Collections')}</th>
                  <th className="p-3.5">{t('dashboard.col_supplements', 'Store Sales')}</th>
                  <th className="p-3.5">{t('dashboard.col_expenses', 'Expenses')}</th>
                  <th className="p-3.5 text-right">{t('dashboard.col_profit', 'Operating Profit')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E9ECEF] dark:divide-[#2E2E33] text-[#171717] dark:text-[#EDEDED]">
                {data.branch_performance.map((b) => (
                  <tr key={b.id} className="hover:bg-neutral-100/60 dark:hover:bg-neutral-800/40 transition-colors min-h-[52px]">
                    <td className="p-3.5 font-semibold text-[#171717] dark:text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-gym-red" />
                      <span>{b.name}</span>
                      {b.code && (
                        <span className="badge-gym-neutral font-mono text-[10px]">
                          {b.code}
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 font-mono">
                      {formatNumber(b.active_members, i18n.language)}
                    </td>
                    <td className="p-3.5 font-mono text-gym-red font-semibold">
                      {formatCurrency(b.collections, i18n.language)}
                    </td>
                    <td className="p-3.5 font-mono">
                      {formatCurrency(b.supplement_sales, i18n.language)}
                    </td>
                    <td className="p-3.5 font-mono text-rose-500">
                      {formatCurrency(b.expenses, i18n.language)}
                    </td>
                    <td className="p-3.5 font-mono text-right font-bold text-gym-red">
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
