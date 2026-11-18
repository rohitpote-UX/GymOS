import React, { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  ArrowRightLeft,
  BarChart3,
  Bot,
  Building2,
  CalendarCheck,
  Coins,
  CreditCard,
  Dumbbell,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  MessageCircle,
  Package,
  Receipt,
  Settings,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Truck,
  User,
  Users,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { LanguageSwitcher } from './LanguageSwitcher';

export const Layout: React.FC = () => {
  const { t } = useTranslation();
  const {
    user,
    activeBranchId,
    activeBranch,
    setActiveBranchId,
    logout,
    stopImpersonating,
    isOnline,
    outboxCount,
    isSyncing,
    triggerSync,
  } = useAuth();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const isOwner = user?.role === 'gym_owner';
  const isManager = user?.role === 'branch_manager';
  const isTrainer = user?.role === 'trainer';
  const isMember = user?.role === 'member';
  const isAccountant = user?.role === 'accountant';
  const isInventory = user?.role === 'inventory_manager';
  const isReception = user?.role === 'receptionist' || user?.role === 'front_desk';
  const canManageBranches = isOwner || isManager;

  const getNavItems = () => {
    if (isMember) {
      return [
        { label: t('nav.member_portal', 'Member Portal'), to: '/portal', icon: User },
        { label: t('nav.support', 'Support & Helpdesk'), to: '/support', icon: LifeBuoy },
      ];
    }

    if (isTrainer) {
      return [
        { label: t('nav.trainer_portal', 'Trainer Portal'), to: '/trainer-portal', icon: Dumbbell },
        { label: t('nav.attendance', 'Attendance'), to: '/attendance', icon: CalendarCheck },
        { label: t('nav.members', 'Athletes & Members'), to: '/members', icon: Users },
        { label: t('nav.support', 'Support & Helpdesk'), to: '/support', icon: LifeBuoy },
      ];
    }

    if (isAccountant) {
      return [
        { label: t('nav.payments', 'Payments'), to: '/payments', icon: Receipt },
        { label: t('nav.cash_closing', 'Cash Register'), to: '/cash-closing', icon: Coins },
        { label: t('nav.expenses', 'Expenses'), to: '/expenses', icon: TrendingDown },
        { label: t('common.finance', 'Profitability & COGS'), to: '/profitability', icon: TrendingUp },
        { label: t('common.suppliers', 'Purchases & Suppliers'), to: '/purchases', icon: Truck },
        { label: t('nav.reports', 'Reports'), to: '/reports', icon: BarChart3 },
        { label: t('nav.support', 'Support & Helpdesk'), to: '/support', icon: LifeBuoy },
      ];
    }

    if (isInventory) {
      return [
        { label: t('nav.pos', 'Supplement POS'), to: '/pos', icon: ShoppingCart },
        { label: t('nav.inventory', 'Inventory Master'), to: '/inventory', icon: Package },
        { label: t('common.suppliers', 'Purchases & Suppliers'), to: '/purchases', icon: Truck },
        { label: t('dashboard.gross_margins', 'Profitability & Margins'), to: '/profitability', icon: TrendingUp },
        { label: t('nav.support', 'Support & Helpdesk'), to: '/support', icon: LifeBuoy },
      ];
    }

    if (isReception) {
      return [
        { label: t('nav.action_center', 'Action Center'), to: '/action-center', icon: ShieldAlert },
        { label: t('nav.attendance', 'Attendance'), to: '/attendance', icon: CalendarCheck },
        { label: t('nav.members', 'Members'), to: '/members', icon: Users },
        { label: t('nav.pos', 'Supplement POS'), to: '/pos', icon: ShoppingCart },
        { label: t('nav.leads', 'Leads CRM'), to: '/leads', icon: Target },
        { label: t('nav.payments', 'Payments'), to: '/payments', icon: Receipt },
        { label: t('nav.cash_closing', 'Cash Register'), to: '/cash-closing', icon: Coins },
        { label: t('nav.whatsapp', 'WhatsApp Automation'), to: '/whatsapp', icon: MessageCircle },
        { label: t('nav.support', 'Support & Helpdesk'), to: '/support', icon: LifeBuoy },
      ];
    }

    // Default: Executive Owner / Branch Manager View
    return [
      { label: t('nav.dashboard', 'Dashboard'), to: '/', icon: LayoutDashboard },
      { label: t('nav.action_center', 'Action Center'), to: '/action-center', icon: ShieldAlert },
      { label: t('nav.ai_advisor', 'AI Business Advisor'), to: '/ai-advisor', icon: Bot },
      { label: t('nav.attendance', 'Attendance'), to: '/attendance', icon: CalendarCheck },
      { label: t('nav.members', 'Members'), to: '/members', icon: Users },
      { label: t('nav.pos', 'Supplement POS'), to: '/pos', icon: ShoppingCart },
      { label: t('nav.inventory', 'Inventory'), to: '/inventory', icon: Package },
      { label: t('common.suppliers', 'Purchases & Suppliers'), to: '/purchases', icon: Truck },
      { label: t('common.finance', 'Profitability & COGS'), to: '/profitability', icon: TrendingUp },
      { label: t('nav.leads', 'Leads CRM'), to: '/leads', icon: Target },
      { label: t('nav.payments', 'Payments'), to: '/payments', icon: Receipt },
      { label: t('nav.cash_closing', 'Cash Register'), to: '/cash-closing', icon: Coins },
      { label: t('nav.expenses', 'Expenses'), to: '/expenses', icon: TrendingDown },
      { label: t('common.memberships', 'Packages'), to: '/plans', icon: Dumbbell },
      { label: t('common.staff', 'Trainers & PT'), to: '/trainers', icon: Dumbbell },
      { label: t('nav.whatsapp', 'WhatsApp Automation'), to: '/whatsapp', icon: MessageCircle },
      { label: t('nav.support', 'Support & Helpdesk'), to: '/support', icon: LifeBuoy },
      { label: t('nav.reports', 'Reports'), to: '/reports', icon: BarChart3 },
      ...(canManageBranches
        ? [
            { label: t('common.branches', 'Branches'), to: '/branches', icon: Building2 },
            { label: t('common.staff', 'Staff & Roles'), to: '/staff', icon: ShieldCheck },
          ]
        : []),
      ...(isOwner
        ? [
            { label: t('auth.plan', 'SaaS Plan'), to: '/billing', icon: CreditCard },
            { label: t('nav.settings', 'Settings'), to: '/settings', icon: Settings },
          ]
        : []),
    ];
  };

  const navItems = getNavItems();

  const handleBranchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = parseInt(e.target.value, 10);
    setActiveBranchId(val);
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col md:flex-row">
      {/* Impersonation Alert Banner */}
      {user?.impersonating && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500/90 backdrop-blur-md text-slate-950 px-4 py-2 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            <span>Super Admin Impersonation Session Active: Viewing as {user.name} ({user.gym?.name})</span>
          </div>
          <button
            onClick={stopImpersonating}
            className="bg-slate-950 text-amber-400 px-3 py-1 rounded text-xs hover:bg-slate-900 transition-colors cursor-pointer"
          >
            Exit Impersonation
          </button>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className={`w-64 bg-[#0f172a] border-r border-slate-800 flex-col justify-between hidden md:flex shrink-0 ${user?.impersonating ? 'pt-10' : ''}`}>
        <div>
          {/* Logo & Brand Header */}
          <div className="p-5 border-b border-slate-800/80 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center font-black text-white text-lg tracking-wider shadow-lg shadow-emerald-900/30">
              {user?.gym?.name ? user.gym.name.substring(0, 2).toUpperCase() : 'OS'}
            </div>
            <div className="overflow-hidden">
              <h1 className="font-bold text-sm tracking-tight text-white truncate">
                {user?.gym?.name || 'Gym Business OS'}
              </h1>
              <p className="text-[11px] text-emerald-400 font-medium tracking-wide uppercase">
                {user?.gym?.branding?.tagline || 'Fitness OS'}
              </p>
            </div>
          </div>

          {/* Language Switcher Row */}
          <div className="px-4 py-2 border-b border-slate-800/60 bg-slate-900/30 flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              {t('auth.switch_language', 'Language')}
            </span>
            <LanguageSwitcher variant="dropdown" />
          </div>

          {/* Branch Switcher (Multi-Branch Navigation) */}
          {user?.branches && user.branches.length > 0 && (
            <div className="px-4 py-3 border-b border-slate-800/60 bg-slate-900/40">
              <label className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase flex items-center gap-1.5 mb-1.5">
                <Building2 className="w-3 h-3 text-emerald-400" />
                {t('members.assigned_branch', 'Active Branch')}
              </label>
              <div className="relative">
                <select
                  value={activeBranchId || ''}
                  onChange={handleBranchChange}
                  className="w-full bg-[#131b2e] border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors"
                >
                  {user.branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name} {branch.is_primary ? `(${t('common.all', 'Primary')})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Nav Links */}
          <nav className="p-3 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-emerald-500/15 text-emerald-400 font-semibold border-l-2 border-emerald-500 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`
                }
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        {/* User Card & Offline Status */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/30">
          {/* Sync / Offline Banner */}
          <div className="flex items-center justify-between mb-3 text-xs">
            <div className="flex items-center gap-1.5">
              {isOnline ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[11px] text-slate-400">Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[11px] text-amber-400">Offline Mode</span>
                </>
              )}
            </div>

            {outboxCount > 0 && (
              <button
                onClick={() => triggerSync()}
                disabled={isSyncing || !isOnline}
                className="bg-emerald-500/20 text-emerald-300 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 hover:bg-emerald-500/30 cursor-pointer disabled:opacity-50"
              >
                <ArrowRightLeft className={`w-2.5 h-2.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{outboxCount} pending</span>
              </button>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-slate-200 truncate">{user?.name}</p>
              <p className="text-[10px] text-slate-400 capitalize">{user?.role?.replace('_', ' ')}</p>
            </div>
            <button
              onClick={() => logout()}
              title="Logout"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header className={`md:hidden bg-[#0f172a] border-b border-slate-800 p-4 flex items-center justify-between sticky top-0 z-40 ${user?.impersonating ? 'mt-8' : ''}`}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center font-bold text-white text-sm">
            {user?.gym?.name ? user.gym.name.substring(0, 2).toUpperCase() : 'OS'}
          </div>
          <div>
            <h1 className="text-xs font-bold text-white truncate max-w-[150px]">{user?.gym?.name}</h1>
            <p className="text-[10px] text-emerald-400 font-medium truncate max-w-[150px]">
              {activeBranch?.name || 'All Branches'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <LanguageSwitcher variant="dropdown" />
          {outboxCount > 0 && (
            <button
              onClick={() => triggerSync()}
              disabled={isSyncing || !isOnline}
              className="bg-emerald-500/20 text-emerald-300 text-[10px] px-2 py-1 rounded-full flex items-center gap-1"
            >
              <ArrowRightLeft className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{outboxCount}</span>
            </button>
          )}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col justify-between p-6">
          <div>
            <div className="flex justify-between items-center mb-6">
              <span className="text-sm font-bold text-white">{user?.gym?.name}</span>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-slate-400">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Mobile Language Selector */}
            <div className="mb-4">
              <label className="text-xs text-slate-400 block mb-1">
                {t('auth.switch_language', 'Language')}
              </label>
              <LanguageSwitcher variant="pill" className="w-full justify-around" />
            </div>

            {/* Mobile Branch Selector */}
            {user?.branches && user.branches.length > 0 && (
              <div className="mb-4">
                <label className="text-xs text-slate-400 block mb-1">
                  {t('members.assigned_branch', 'Select Branch')}
                </label>
                <select
                  value={activeBranchId || ''}
                  onChange={(e) => {
                    handleBranchChange(e);
                    setMobileMenuOpen(false);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 text-xs rounded-lg p-2.5 text-white"
                >
                  {user.branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <nav className="space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm text-slate-300 hover:bg-slate-800"
                >
                  <item.icon className="w-5 h-5 text-emerald-400" />
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
          </div>

          <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-white">{user?.name}</p>
              <p className="text-xs text-slate-400">{user?.role}</p>
            </div>
            <button onClick={() => logout()} className="text-rose-400 text-sm font-medium flex items-center gap-1.5">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>
      )}

      {/* Main Content Viewport */}
      <main className={`flex-1 overflow-y-auto ${user?.impersonating ? 'pt-8 md:pt-10' : ''}`}>
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
