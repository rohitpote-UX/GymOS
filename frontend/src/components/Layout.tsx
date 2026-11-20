import React, { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowRightLeft,
  Building2,
  CalendarCheck,
  ChevronDown,
  ChevronRight,
  Coins,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  Search,
  Sparkles,
  Users,
  Wifi,
  WifiOff,
  X,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { LanguageSwitcher } from './LanguageSwitcher';
import { GlobalSearchModal } from './GlobalSearchModal';
import { QuickActionsModal } from './QuickActionsModal';
import {
  getFilteredNavigation,
  NavDestination,
} from '../config/navigationConfig';

export const Layout: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

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
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);

  // Filtered navigation destinations based on user role & gym active modules
  const destinations = useMemo(() => getFilteredNavigation(user), [user]);

  // Track expanded destinations in sidebar
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    destinations.forEach((dest) => {
      // Auto-expand if current route matches destination or any of its subItems
      const isCurrent =
        location.pathname === dest.to ||
        dest.subItems?.some((sub) => location.pathname === sub.to);
      if (isCurrent) {
        initial[dest.id] = true;
      }
    });
    return initial;
  });

  // Whenever URL changes, auto-expand the parent destination
  useEffect(() => {
    destinations.forEach((dest) => {
      const isCurrent =
        location.pathname === dest.to ||
        dest.subItems?.some((sub) => location.pathname === sub.to);
      if (isCurrent && !expandedGroups[dest.id]) {
        setExpandedGroups((prev) => ({ ...prev, [dest.id]: true }));
      }
    });
  }, [location.pathname, destinations]);

  // Global keyboard shortcuts (Ctrl+K or Cmd+K for search)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchModalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const handleBranchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = parseInt(e.target.value, 10);
    setActiveBranchId(val);
  };

  const isDestinationActive = (dest: NavDestination): boolean => {
    if (dest.to === '/' && location.pathname === '/') return true;
    if (dest.to !== '/' && location.pathname.startsWith(dest.to)) return true;
    if (dest.subItems?.some((sub) => location.pathname === sub.to)) return true;
    return false;
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col md:flex-row">
      {/* Impersonation Alert Banner */}
      {user?.impersonating && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500/95 backdrop-blur-md text-slate-950 px-4 py-2 text-xs font-semibold flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>
              Super Admin Impersonation Session Active: Viewing as {user.name} ({user.gym?.name})
            </span>
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
      <aside
        className={`w-64 bg-[#0f172a] border-r border-slate-800 flex-col justify-between hidden md:flex shrink-0 ${
          user?.impersonating ? 'pt-10' : ''
        }`}
      >
        <div className="flex-1 flex flex-col min-h-0">
          {/* Logo & Brand Header */}
          <div className="p-4 border-b border-slate-800/80 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center font-black text-white text-lg tracking-wider shadow-lg shadow-emerald-900/30 shrink-0">
              {user?.gym?.name ? user.gym.name.substring(0, 2).toUpperCase() : 'OS'}
            </div>
            <div className="overflow-hidden min-w-0">
              <h1 className="font-bold text-sm tracking-tight text-white truncate">
                {user?.gym?.name || 'Gym Business OS'}
              </h1>
              <p className="text-[11px] text-emerald-400 font-medium tracking-wide uppercase truncate">
                {user?.gym?.branding?.tagline || 'Fitness Business OS'}
              </p>
            </div>
          </div>

          {/* Search & Quick Action Toolbar */}
          <div className="p-3 border-b border-slate-800/60 bg-slate-900/30 space-y-2">
            {/* Global Search Trigger */}
            <button
              onClick={() => setSearchModalOpen(true)}
              className="w-full bg-[#131b2e] hover:bg-slate-800/80 border border-slate-700/60 hover:border-slate-600 rounded-xl px-3 py-2 text-xs text-slate-400 hover:text-slate-200 transition-all flex items-center justify-between group cursor-pointer shadow-sm"
            >
              <div className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-400 transition-colors" />
                <span className="truncate">{t('nav.global_search', 'Search...')}</span>
              </div>
              <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono">
                ⌘K
              </kbd>
            </button>

            {/* Quick Actions Trigger */}
            <button
              onClick={() => setQuickActionsOpen(true)}
              className="w-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-950/20"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{t('nav.quick_actions', 'Quick Actions')}</span>
            </button>
          </div>

          {/* Language Switcher Row */}
          <div className="px-3.5 py-2 border-b border-slate-800/60 bg-slate-900/20 flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              {t('auth.switch_language', 'Language')}
            </span>
            <LanguageSwitcher variant="dropdown" />
          </div>

          {/* Branch Switcher (Multi-Branch Selection) */}
          {user?.branches && user.branches.length > 0 && (
            <div className="px-3.5 py-2.5 border-b border-slate-800/60 bg-slate-900/30">
              <label className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase flex items-center gap-1.5 mb-1">
                <Building2 className="w-3 h-3 text-emerald-400" />
                {t('members.assigned_branch', 'Active Branch')}
              </label>
              <div className="relative">
                <select
                  value={activeBranchId || ''}
                  onChange={handleBranchChange}
                  className="w-full bg-[#131b2e] border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer"
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

          {/* Collapsible Categorized Nav Links (8 Destinations) */}
          <nav className="flex-1 overflow-y-auto p-2.5 space-y-1">
            {destinations.map((dest) => {
              const Icon = dest.icon;
              const hasSubItems = dest.subItems && dest.subItems.length > 0;
              const isExpanded = !!expandedGroups[dest.id];
              const isActive = isDestinationActive(dest);

              if (!hasSubItems) {
                // Direct single destination link (e.g. AI Advisor or Member Portal)
                return (
                  <NavLink
                    key={dest.id}
                    to={dest.to}
                    end={dest.to === '/'}
                    className={({ isActive: directActive }) =>
                      `flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        directActive
                          ? 'bg-emerald-500/15 text-emerald-400 font-bold border-l-2 border-emerald-500 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{t(dest.labelKey, dest.defaultLabel)}</span>
                  </NavLink>
                );
              }

              // Collapsible Group Destination
              return (
                <div key={dest.id} className="space-y-0.5">
                  <button
                    onClick={() => toggleGroup(dest.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'text-white bg-slate-800/60'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive ? 'text-emerald-400' : 'text-slate-400'
                        }`}
                      />
                      <span className="truncate">{t(dest.labelKey, dest.defaultLabel)}</span>
                    </div>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {/* Collapsible Submenu */}
                  {isExpanded && (
                    <div className="pl-6 pr-1 py-0.5 space-y-0.5 border-l border-slate-800/60 ml-4 animate-in slide-in-from-top-1 duration-150">
                      {dest.subItems!.map((sub) => {
                        const SubIcon = sub.icon;
                        return (
                          <NavLink
                            key={sub.id}
                            to={sub.to}
                            end={sub.to === '/'}
                            className={({ isActive: subActive }) =>
                              `flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                                subActive
                                  ? 'bg-emerald-500/15 text-emerald-400 font-semibold'
                                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                              }`
                            }
                          >
                            <SubIcon className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{t(sub.labelKey, sub.defaultLabel)}</span>
                          </NavLink>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {/* User Card & Offline Status */}
        <div className="p-3.5 border-t border-slate-800/80 bg-slate-900/40 shrink-0">
          {/* Sync / Offline Banner */}
          <div className="flex items-center justify-between mb-2.5 text-xs">
            <div className="flex items-center gap-1.5">
              {isOnline ? (
                <>
                  <Wifi className="w-3 h-3 text-emerald-400" />
                  <span className="text-[10px] text-slate-400">Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-amber-400" />
                  <span className="text-[10px] text-amber-400">Offline Mode</span>
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
            <div className="overflow-hidden min-w-0 pr-2">
              <p className="text-xs font-semibold text-slate-200 truncate">{user?.name}</p>
              <p className="text-[10px] text-slate-400 capitalize truncate">
                {user?.role?.replace('_', ' ')}
              </p>
            </div>
            <button
              onClick={() => logout()}
              title={t('common.logout', 'Logout')}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header
        className={`md:hidden bg-[#0f172a] border-b border-slate-800 p-3.5 flex items-center justify-between sticky top-0 z-40 ${
          user?.impersonating ? 'mt-8' : ''
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center font-bold text-white text-xs shrink-0">
            {user?.gym?.name ? user.gym.name.substring(0, 2).toUpperCase() : 'OS'}
          </div>
          <div className="min-w-0">
            <h1 className="text-xs font-bold text-white truncate max-w-[120px]">
              {user?.gym?.name}
            </h1>
            <p className="text-[10px] text-emerald-400 font-medium truncate max-w-[120px]">
              {activeBranch?.name || 'All Branches'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setSearchModalOpen(true)}
            className="p-2 rounded-lg bg-slate-800/80 text-slate-300 hover:text-white"
            title={t('common.search', 'Search')}
          >
            <Search className="w-4 h-4" />
          </button>

          <button
            onClick={() => setQuickActionsOpen(true)}
            className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
            title={t('common.quick_actions', 'Quick Actions')}
          >
            <Zap className="w-4 h-4" />
          </button>

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
            className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white ml-1"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Off-Canvas Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col justify-between p-4 overflow-y-auto animate-in fade-in duration-150">
          <div>
            <div className="flex justify-between items-center pb-3 mb-3 border-b border-slate-800">
              <span className="text-sm font-bold text-white">{user?.gym?.name}</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile Language & Branch Controls */}
            <div className="space-y-3 mb-4 p-3 bg-slate-900/50 rounded-xl border border-slate-800">
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  {t('auth.switch_language', 'Language')}
                </label>
                <LanguageSwitcher variant="pill" className="w-full justify-around" />
              </div>

              {user?.branches && user.branches.length > 0 && (
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                    {t('members.assigned_branch', 'Select Branch')}
                  </label>
                  <select
                    value={activeBranchId || ''}
                    onChange={(e) => {
                      handleBranchChange(e);
                      setMobileMenuOpen(false);
                    }}
                    className="w-full bg-[#131b2e] border border-slate-700 text-xs rounded-lg p-2 text-white"
                  >
                    {user.branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Mobile Categorized Navigation */}
            <nav className="space-y-1">
              {destinations.map((dest) => {
                const Icon = dest.icon;
                const hasSubItems = dest.subItems && dest.subItems.length > 0;
                const isExpanded = !!expandedGroups[dest.id];
                const isActive = isDestinationActive(dest);

                if (!hasSubItems) {
                  return (
                    <Link
                      key={dest.id}
                      to={dest.to}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold ${
                        isActive
                          ? 'bg-emerald-500/15 text-emerald-400 font-bold'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <Icon className="w-4 h-4 text-emerald-400" />
                      <span>{t(dest.labelKey, dest.defaultLabel)}</span>
                    </Link>
                  );
                }

                return (
                  <div key={dest.id} className="space-y-0.5">
                    <button
                      onClick={() => toggleGroup(dest.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold ${
                        isActive ? 'text-white bg-slate-800/80' : 'text-slate-300 hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4 text-emerald-400" />
                        <span>{t(dest.labelKey, dest.defaultLabel)}</span>
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 transition-transform duration-200 ${
                          isExpanded ? 'rotate-180 text-emerald-400' : 'text-slate-400'
                        }`}
                      />
                    </button>

                    {isExpanded && (
                      <div className="pl-6 space-y-1 py-1 border-l border-slate-800 ml-4">
                        {dest.subItems!.map((sub) => {
                          const SubIcon = sub.icon;
                          const isSubActive = location.pathname === sub.to;
                          return (
                            <Link
                              key={sub.id}
                              to={sub.to}
                              onClick={() => setMobileMenuOpen(false)}
                              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs ${
                                isSubActive
                                  ? 'bg-emerald-500/15 text-emerald-400 font-bold'
                                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                              }`}
                            >
                              <SubIcon className="w-3.5 h-3.5" />
                              <span>{t(sub.labelKey, sub.defaultLabel)}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>

          {/* Mobile Footer */}
          <div className="pt-4 mt-4 border-t border-slate-800 flex justify-between items-center">
            <div>
              <p className="text-xs font-semibold text-white">{user?.name}</p>
              <p className="text-[10px] text-slate-400 capitalize">{user?.role?.replace('_', ' ')}</p>
            </div>
            <button
              onClick={() => logout()}
              className="px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-xs font-semibold flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{t('common.logout', 'Logout')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Content Workspace Area */}
      <main className="flex-1 overflow-x-hidden min-h-screen flex flex-col pb-32 sm:pb-36 md:pb-8">
        <Outlet />
      </main>

      {/* Mobile Persistent Bottom Action Bar (Phase 8: Mobile-First Accessibility) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0f172a]/95 backdrop-blur-md border-t border-slate-800/90 px-3 py-2 flex items-center justify-around shadow-[0_-8px_25px_rgba(0,0,0,0.6)] safe-bottom">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex flex-col items-center justify-center min-w-[54px] py-1 text-[10px] font-semibold transition-colors cursor-pointer ${
              isActive ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`
          }
        >
          <LayoutDashboard className="w-5 h-5 mb-0.5" />
          <span>{t('nav.bottom_home', 'Home')}</span>
        </NavLink>

        <NavLink
          to="/attendance"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center min-w-[54px] py-1 text-[10px] font-semibold transition-colors cursor-pointer ${
              isActive ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`
          }
        >
          <CalendarCheck className="w-5 h-5 mb-0.5" />
          <span>{t('nav.bottom_attendance', 'Attendance')}</span>
        </NavLink>

        {/* Center Floating Quick Action Button */}
        <button
          onClick={() => setQuickActionsOpen(true)}
          className="flex flex-col items-center justify-center -mt-5 bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 w-12 h-12 rounded-full shadow-lg shadow-emerald-500/30 font-bold cursor-pointer hover:scale-105 active:scale-95 transition-all"
          title={t('nav.bottom_quick', 'Quick Actions')}
        >
          <Zap className="w-6 h-6 fill-slate-950" />
        </button>

        <NavLink
          to="/members"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center min-w-[54px] py-1 text-[10px] font-semibold transition-colors cursor-pointer ${
              isActive ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`
          }
        >
          <Users className="w-5 h-5 mb-0.5" />
          <span>{t('nav.bottom_members', 'Members')}</span>
        </NavLink>

        <NavLink
          to="/payments"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center min-w-[54px] py-1 text-[10px] font-semibold transition-colors cursor-pointer ${
              isActive ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`
          }
        >
          <Coins className="w-5 h-5 mb-0.5" />
          <span>{t('nav.bottom_fees', 'Fees')}</span>
        </NavLink>
      </nav>

      {/* Global Modals */}
      <GlobalSearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
      />

      <QuickActionsModal
        isOpen={quickActionsOpen}
        onClose={() => setQuickActionsOpen(false)}
      />
    </div>
  );
};

export default Layout;
