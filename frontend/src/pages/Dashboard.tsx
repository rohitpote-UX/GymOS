import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bot,
  Boxes,
  Building2,
  Calendar,
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
  ShoppingCart,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  UserCheck,
  UserMinus,
  Users,
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
  const { user, activeBranch, activeBranchId } = useAuth();
  const [data, setData] = useState<OwnerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Period Filter: 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom'
  const [period, setPeriod] = useState<string>('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

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

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Banner / Welcome & Period Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>{t('dashboard.title', 'Owner Business Intelligence')}</span>
              {activeBranch && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-emerald-400 font-semibold">
                  {activeBranch.name}
                </span>
              )}
            </h1>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
              Live
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {t('dashboard.subtitle', 'Real-time key performance indicators and financial health')}
          </p>
        </div>

        {/* Quick Action Navigation Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to="/action-center"
            className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold flex items-center gap-1.5 transition-colors border border-rose-500/30"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>{t('common.action_center', 'Action Radar')}</span>
          </Link>
          <Link
            to="/ai-advisor"
            className="px-3 py-2 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-xs font-bold flex items-center gap-1.5 transition-colors border border-indigo-500/30"
          >
            <Bot className="w-3.5 h-3.5" />
            <span>{t('common.ai_advisor', 'AI Advisor')}</span>
          </Link>
          <Link
            to="/attendance"
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700"
          >
            <CalendarCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t('common.attendance', 'Attendance')}</span>
          </Link>
          <Link
            to="/payments"
            className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-lg shadow-emerald-950/40"
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>{t('members.collect_due', 'Collect Fee')}</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Period Selection Bar */}
      <div className="bg-[#0f172a] border border-slate-800 p-3.5 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <span className="text-[11px] text-slate-400 uppercase font-bold px-2 shrink-0">{t('common.timeframe', 'Timeframe')}:</span>
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
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
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
          <div className="flex items-center gap-2 text-xs">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-white"
            />
            <span className="text-slate-500">{t('common.to', 'to')}</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-white"
            />
            <button
              onClick={fetchDashboard}
              className="px-3 py-1 bg-emerald-500 text-slate-950 font-bold rounded-lg text-xs cursor-pointer"
            >
              {t('common.apply', 'Apply')}
            </button>
          </div>
        )}

        <div className="text-[11px] text-slate-400 font-mono hidden md:block">
          {data ? `Range: ${data.from} to ${data.to}` : ''}
        </div>
      </div>

      {/* Action Center Operational Radar Ribbon */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div className="text-xs">
            <div className="font-bold text-white flex items-center gap-2">
              <span>{t('dashboard.radar_title', 'Action Center Radar')}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {t('dashboard.radar_desc', 'Live operational alerts requiring staff triage & automated customer follow-ups')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to="/action-center?search=expiring"
            className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold hover:bg-amber-500/20 transition-colors flex items-center gap-1.5"
          >
            <span>{formatNumber(kpis?.expiring_memberships ?? 0, i18n.language)} {t('dashboard.expiring_memberships', 'Expiring')}</span>
          </Link>

          <Link
            to="/members?has_due=1"
            className="px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold hover:bg-rose-500/20 transition-colors flex items-center gap-1.5"
          >
            <span>{t('dashboard.outstanding_dues', 'Overdue Dues')}</span>
          </Link>

          <Link
            to="/action-center"
            className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-emerald-950/20 flex items-center gap-1"
          >
            <span>{t('dashboard.triage_all', 'Triage All →')}</span>
          </Link>
        </div>
      </div>

      {/* Primary KPI Grid (Top 4 Big Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {/* Active Members */}
        <div className="bg-[#0f172a] border border-slate-800 p-4.5 rounded-2xl flex flex-col justify-between hover:border-slate-700 transition-colors">
          <div>
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] uppercase font-bold tracking-wider">
                {t('dashboard.active_members', 'Active Members')}
              </span>
              <Users className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-black text-white mt-2">
              {formatNumber(kpis?.active_members ?? 0, i18n.language)}
              <span className="text-xs text-slate-500 font-normal ml-1">
                / {formatNumber(kpis?.total_members ?? 0, i18n.language)}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>+{formatNumber(kpis?.new_members ?? 0, i18n.language)} new</span>
            <span className="text-amber-400 font-medium">
              {formatNumber(kpis?.expiring_memberships ?? 0, i18n.language)} {t('dashboard.expiring_memberships', 'expiring')}
            </span>
          </div>
        </div>

        {/* Today's Attendance & Occupancy */}
        <div className="bg-[#0f172a] border border-slate-800 p-4.5 rounded-2xl flex flex-col justify-between hover:border-slate-700 transition-colors">
          <div>
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] uppercase font-bold tracking-wider">
                {t('dashboard.today_attendance', "Today's Visits")}
              </span>
              <CalendarCheck className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-3xl font-black text-white mt-2">
              {formatNumber(kpis?.today_attendance ?? 0, i18n.language)}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1 text-emerald-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {formatNumber(kpis?.currently_inside ?? 0, i18n.language)} {t('attendance.inside_now', 'inside')}
            </span>
            <Link to="/attendance" className="text-slate-400 hover:text-white underline">
              {t('attendance.qr_scan_tab', 'Scanner')}
            </Link>
          </div>
        </div>

        {/* Membership Collections */}
        <div className="bg-[#0f172a] border border-slate-800 p-4.5 rounded-2xl flex flex-col justify-between hover:border-slate-700 transition-colors">
          <div>
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] uppercase font-bold tracking-wider">
                {t('dashboard.monthly_collections', 'Fee Collections')}
              </span>
              <Receipt className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-black text-white mt-2">
              {formatCurrency(kpis?.membership_collections ?? 0, i18n.language)}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
            <span className="text-rose-400 font-semibold">
              {t('dashboard.outstanding_dues', 'Dues')}: {formatCurrency(kpis?.outstanding_dues ?? 0, i18n.language)}
            </span>
            <span className="text-emerald-400 font-mono text-[10px]">
              +{data?.growth_trend?.revenue_growth_percent ?? 0}% MoM
            </span>
          </div>
        </div>

        {/* Net Operating Profit */}
        <div className="bg-gradient-to-br from-[#0f172a] to-emerald-950/30 border border-emerald-500/30 p-4.5 rounded-2xl flex flex-col justify-between hover:border-emerald-500/50 transition-colors shadow-lg">
          <div>
            <div className="flex items-center justify-between text-emerald-400">
              <span className="text-[11px] uppercase font-bold tracking-wider">
                {t('dashboard.operating_profit', 'Net Operating Profit')}
              </span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-black text-emerald-400 mt-2">
              {formatCurrency(kpis?.operating_profit ?? 0, i18n.language)}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-300">
            <span>Margin: {kpis?.operating_margin_percent ?? 0}%</span>
            <span className="text-emerald-400 font-bold">
              +{data?.growth_trend?.profit_growth_percent ?? 0}%
            </span>
          </div>
        </div>
      </div>

      {/* Financial Formula Breakdown Card (Collections + Supplement Gross Profit - Expenses) */}
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
            <div className="text-lg font-black text-white">
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
            <div className="text-lg font-black text-white">
              {formatCurrency(kpis?.supplement_gross_profit ?? 0, i18n.language)}
            </div>
            <span className="text-[10px] text-slate-500">
              Sales: {formatCurrency(kpis?.supplement_revenue ?? 0, i18n.language)} − COGS: {formatCurrency(kpis?.supplement_cogs ?? 0, i18n.language)}
            </span>
          </div>

          {/* Box 3: Total Expenses */}
          <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-rose-400">
              3. {t('dashboard.monthly_expenses', 'Operating Expenses')}
            </span>
            <div className="text-lg font-black text-rose-400">
              − {formatCurrency(kpis?.total_expenses ?? 0, i18n.language)}
            </div>
            <span className="text-[10px] text-slate-500">Rent, electricity, salaries, equipment</span>
          </div>

          {/* Box 4: Resulting Operating Profit */}
          <div className="bg-emerald-950/20 p-3.5 rounded-xl border border-emerald-500/30 space-y-1">
            <span className="text-[10px] uppercase font-bold text-emerald-400">
              {t('dashboard.operating_profit', 'Net Operating Profit')}
            </span>
            <div className="text-lg font-black text-emerald-400">
              = {formatCurrency(kpis?.operating_profit ?? 0, i18n.language)}
            </div>
            <span className="text-[10px] text-emerald-300/80">Realized operating surplus</span>
          </div>
        </div>
      </div>

      {/* Middle Row: Supplement Revenue & Leads Conversion */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Supplement & POS Snapshot */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Package className="w-4 h-4 text-emerald-400" />
                  <span>{t('dashboard.supplement_sales', 'Supplement & POS Performance')}</span>
                </h3>
                <p className="text-[11px] text-slate-400">Weighted Average Costing & Retail Margins</p>
              </div>
              <Link to="/pos" className="text-xs text-emerald-400 hover:text-emerald-300 font-bold">
                {t('dashboard.open_pos', 'Open POS')} →
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-4 text-xs">
              <div>
                <span className="text-[10px] uppercase text-slate-400 block font-semibold">Total Revenue</span>
                <span className="text-base font-bold text-white">
                  {formatCurrency(kpis?.supplement_revenue ?? 0, i18n.language)}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-400 block font-semibold">COGS Cost</span>
                <span className="text-base font-bold text-slate-300">
                  {formatCurrency(kpis?.supplement_cogs ?? 0, i18n.language)}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-400 block font-semibold">{t('dashboard.gross_margins', 'Gross Margin')}</span>
                <span className="text-base font-bold text-emerald-400">
                  {kpis?.supplement_gross_margin_percent ?? 0}%
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>Collected Cash: {formatCurrency(kpis?.supplement_collected ?? 0, i18n.language)}</span>
            <Link to="/profitability" className="text-slate-300 hover:text-white underline text-[11px]">
              Full COGS breakdown
            </Link>
          </div>
        </div>

        {/* Leads & Conversion Funnel */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Target className="w-4 h-4 text-sky-400" />
                  <span>{t('dashboard.leads_conversion', 'Leads & CRM Conversion Funnel')}</span>
                </h3>
                <p className="text-[11px] text-slate-400">Enquiries, trials & member conversion efficiency</p>
              </div>
              <Link to="/leads" className="text-xs text-sky-400 hover:text-sky-300 font-bold">
                {t('nav.leads', 'View CRM')} →
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-4 text-xs">
              <div>
                <span className="text-[10px] uppercase text-slate-400 block font-semibold">New Enquiries</span>
                <span className="text-base font-bold text-white">{formatNumber(kpis?.total_leads ?? 0, i18n.language)}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-400 block font-semibold">Converted</span>
                <span className="text-base font-bold text-emerald-400">{formatNumber(kpis?.converted_leads ?? 0, i18n.language)}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-400 block font-semibold">Conversion %</span>
                <span className="text-base font-bold text-sky-400">{kpis?.conversion_rate ?? 0}%</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>High conversion efficiency indicates strong reception follow-ups.</span>
          </div>
        </div>
      </div>

      {/* Multi-Branch Performance Comparison Matrix */}
      {data?.branch_performance && data.branch_performance.length > 0 && (
        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-400" />
                <span>{t('dashboard.branch_performance', 'Multi-Branch Performance Matrix')}</span>
              </h3>
              <p className="text-[11px] text-slate-400">Comparative revenue, cost & profit margin per branch</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Branch Name</th>
                  <th className="py-2.5 px-3">{t('dashboard.active_members', 'Active Members')}</th>
                  <th className="py-2.5 px-3">{t('dashboard.monthly_collections', 'Membership Fees')}</th>
                  <th className="py-2.5 px-3">{t('common.pos', 'Supplements')}</th>
                  <th className="py-2.5 px-3">{t('common.expenses', 'Expenses')}</th>
                  <th className="py-2.5 px-3 text-right">{t('dashboard.operating_profit', 'Net Operating Profit')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {data.branch_performance.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-800/30">
                    <td className="py-3 px-3">
                      <div className="font-bold text-white">{b.name}</div>
                      {b.code && <div className="text-[10px] text-slate-400 font-mono">{b.code}</div>}
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-200">{formatNumber(b.active_members, i18n.language)}</td>
                    <td className="py-3 px-3 font-mono">{formatCurrency(b.collections, i18n.language)}</td>
                    <td className="py-3 px-3 font-mono">{formatCurrency(b.supplement_sales, i18n.language)}</td>
                    <td className="py-3 px-3 font-mono text-rose-400">{formatCurrency(b.expenses, i18n.language)}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
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
