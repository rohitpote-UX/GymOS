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
import { ThemeSwitcher } from './ThemeSwitcher';
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
    <div className="min-h-screen bg-white dark:bg-[#101010] text-[#171717] dark:text-[#FFFFFF] flex flex-col md:flex-row transition-colors">
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

      {/* Desktop Sidebar (Red & White in Light Mode / Red & Black in Dark Mode) */}
      <aside
        className={`w-64 bg-[#F7F7F7] dark:bg-[#1C1C1C] border-r border-[#E8E8E8] dark:border-[#303030] flex-col justify-between hidden md:flex shrink-0 transition-colors ${
          user?.impersonating ? 'pt-10' : ''
        }`}
      >
        <div className="flex-1 flex flex-col min-h-0">
          {/* Logo & Brand Header */}
          <div className="p-4 border-b border-[#E8E8E8] dark:border-[#303030] flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D92332] to-[#B91C2B] dark:from-[#F02D3A] dark:to-[#B91C2B] flex items-center justify-center font-black text-white text-lg tracking-wider shadow-md shadow-red-600/30 shrink-0">
              {user?.gym?.name ? user.gym.name.substring(0, 2).toUpperCase() : 'OS'}
            </div>
            <div className="overflow-hidden min-w-0">
              <h1 className="font-bold text-sm tracking-tight text-[#171717] dark:text-white truncate">
                {user?.gym?.name || 'Gym Business OS'}
              </h1>
              <p className="text-[11px] text-[#D92332] dark:text-[#F02D3A] font-semibold tracking-wide uppercase truncate">
                {user?.gym?.branding?.tagline || 'Fitness Business OS'}
              </p>
            </div>
          </div>

          {/* Search & Quick Action Toolbar */}
          <div className="p-3 border-b border-[#E8E8E8] dark:border-[#303030] bg-neutral-100/50 dark:bg-neutral-900/30 space-y-2">
            {/* Global Search Trigger */}
            <button
              onClick={() => setSearchModalOpen(true)}
              className="w-full bg-white dark:bg-[#141414] hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-[#E8E8E8] dark:border-[#303030] rounded-xl px-3 py-2 text-xs text-[#707070] dark:text-[#A3A3A3] hover:text-[#171717] dark:hover:text-white transition-all flex items-center justify-between group cursor-pointer shadow-sm"
            >
              <div className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-[#707070] dark:text-[#A3A3A3] group-hover:text-[#D92332] dark:group-hover:text-[#F02D3A] transition-colors" />
                <span className="truncate">{t('nav.global_search', 'Search...')}</span>
              </div>
              <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-[#707070] dark:text-[#A3A3A3] border border-[#E8E8E8] dark:border-[#303030] font-mono">
                ⌘K
              </kbd>
            </button>

            {/* Quick Actions Trigger */}
            <button
              onClick={() => setQuickActionsOpen(true)}
              className="w-full bg-[#D92332]/10 hover:bg-[#D92332]/20 dark:bg-[#F02D3A]/15 dark:hover:bg-[#F02D3A]/25 text-[#D92332] dark:text-[#F02D3A] border border-[#D92332]/30 dark:border-[#F02D3A]/30 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-red-600/10"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{t('nav.quick_actions', 'Quick Actions')}</span>
            </button>
          </div>

          {/* Language & Theme Switcher Row */}
          <div className="px-3 py-2 border-b border-[#E8E8E8] dark:border-[#303030] bg-neutral-100/40 dark:bg-neutral-900/20 flex items-center justify-between gap-2">
            <LanguageSwitcher variant="dropdown" />
            <ThemeSwitcher variant="pill" />
          </div>

          {/* Branch Switcher (Multi-Branch Selection) */}
          {user?.branches && user.branches.length > 0 && (
            <div className="px-3.5 py-2.5 border-b border-[#E8E8E8] dark:border-[#303030] bg-neutral-100/30 dark:bg-neutral-900/20">
              <label className="text-[10px] font-semibold tracking-wider text-[#707070] dark:text-[#A3A3A3] uppercase flex items-center gap-1.5 mb-1">
                <Building2 className="w-3 h-3 text-[#D92332] dark:text-[#F02D3A]" />
                {t('members.assigned_branch', 'Active Branch')}
              </label>
              <div className="relative">
                <select
                  value={activeBranchId || ''}
                  onChange={handleBranchChange}
                  className="w-full bg-white dark:bg-[#141414] border border-[#E8E8E8] dark:border-[#303030] text-xs rounded-lg px-2.5 py-1.5 text-[#171717] dark:text-white focus:outline-none focus:border-[#D92332] dark:focus:border-[#F02D3A] transition-colors cursor-pointer"
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
                return (
                  <NavLink
                    key={dest.id}
                    to={dest.to}
                    end={dest.to === '/'}
                    className={({ isActive: directActive }) =>
                      `flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        directActive
                          ? 'bg-[#D92332]/10 dark:bg-[#F02D3A]/15 text-[#D92332] dark:text-[#F02D3A] font-bold border-l-2 border-[#D92332] dark:border-[#F02D3A] shadow-sm'
                          : 'text-[#707070] dark:text-[#A3A3A3] hover:text-[#171717] dark:hover:text-white hover:bg-neutral-200/50 dark:hover:bg-neutral-800/40'
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
                        ? 'text-[#171717] dark:text-white bg-neutral-200/60 dark:bg-neutral-800/60'
                        : 'text-[#707070] dark:text-[#A3A3A3] hover:text-[#171717] dark:hover:text-white hover:bg-neutral-200/40 dark:hover:bg-neutral-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive ? 'text-[#D92332] dark:text-[#F02D3A]' : 'text-[#707070] dark:text-[#A3A3A3]'
                        }`}
                      />
                      <span className="truncate">{t(dest.labelKey, dest.defaultLabel)}</span>
                    </div>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-[#707070] dark:text-[#A3A3A3] transition-transform duration-200 shrink-0 ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {/* Collapsible Submenu */}
                  {isExpanded && (
                    <div className="pl-6 pr-1 py-0.5 space-y-0.5 border-l border-[#E8E8E8] dark:border-[#303030] ml-4 animate-in slide-in-from-top-1 duration-150">
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
                                  ? 'bg-[#D92332]/10 dark:bg-[#F02D3A]/15 text-[#D92332] dark:text-[#F02D3A] font-semibold'
                                  : 'text-[#707070] dark:text-[#A3A3A3] hover:text-[#171717] dark:hover:text-white hover:bg-neutral-200/40 dark:hover:bg-neutral-800/40'
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
        <div className="p-3.5 border-t border-[#E8E8E8] dark:border-[#303030] bg-neutral-100/50 dark:bg-neutral-900/40 shrink-0">
          {/* Sync / Offline Banner */}
          <div className="flex items-center justify-between mb-2.5 text-xs">
            <div className="flex items-center gap-1.5">
              {isOnline ? (
                <>
                  <Wifi className="w-3 h-3 text-emerald-500" />
                  <span className="text-[10px] text-[#707070] dark:text-[#A3A3A3]">Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-amber-500" />
                  <span className="text-[10px] text-amber-500">Offline Mode</span>
                </>
              )}
            </div>

            {outboxCount > 0 && (
              <button
                onClick={() => triggerSync()}
                disabled={isSyncing || !isOnline}
                className="bg-[#D92332]/15 text-[#D92332] dark:text-[#F02D3A] text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 hover:bg-[#D92332]/25 cursor-pointer disabled:opacity-50"
              >
                <ArrowRightLeft className={`w-2.5 h-2.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{outboxCount} pending</span>
              </button>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="overflow-hidden min-w-0 pr-2">
              <p className="text-xs font-semibold text-[#171717] dark:text-white truncate">{user?.name}</p>
              <p className="text-[10px] text-[#707070] dark:text-[#A3A3A3] capitalize truncate">
                {user?.role?.replace('_', ' ')}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <ThemeSwitcher variant="icon" />
              <button
                onClick={() => logout()}
                title={t('common.logout', 'Logout')}
                className="p-1.5 rounded-lg text-[#707070] dark:text-[#A3A3A3] hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Top Header (Red & White in Light Mode / Red & Black in Dark Mode) */}
      <header
        className={`md:hidden bg-[#F7F7F7] dark:bg-[#1C1C1C] border-b border-[#E8E8E8] dark:border-[#303030] p-3.5 flex items-center justify-between sticky top-0 z-40 transition-colors ${
          user?.impersonating ? 'mt-8' : ''
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#D92332] to-[#B91C2B] dark:from-[#F02D3A] dark:to-[#B91C2B] flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-md shadow-red-600/20">
            {user?.gym?.name ? user.gym.name.substring(0, 2).toUpperCase() : 'OS'}
          </div>
          <div className="min-w-0">
            <h1 className="text-xs font-bold text-[#171717] dark:text-white truncate max-w-[120px]">
              {user?.gym?.name}
            </h1>
            <p className="text-[10px] text-[#D92332] dark:text-[#F02D3A] font-medium truncate max-w-[120px]">
              {activeBranch?.name || 'All Branches'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setSearchModalOpen(true)}
            className="p-2 rounded-lg bg-neutral-200/60 dark:bg-neutral-800/80 text-[#707070] dark:text-[#A3A3A3] hover:text-[#171717] dark:hover:text-white"
            title={t('common.search', 'Search')}
          >
            <Search className="w-4 h-4" />
          </button>

          <button
            onClick={() => setQuickActionsOpen(true)}
            className="p-2 rounded-lg bg-[#D92332]/10 dark:bg-[#F02D3A]/15 text-[#D92332] dark:text-[#F02D3A] border border-[#D92332]/20 dark:border-[#F02D3A]/20"
            title={t('common.quick_actions', 'Quick Actions')}
          >
            <Zap className="w-4 h-4" />
          </button>

          <ThemeSwitcher variant="icon" />
          <LanguageSwitcher variant="dropdown" />

          {outboxCount > 0 && (
            <button
              onClick={() => triggerSync()}
              disabled={isSyncing || !isOnline}
              className="bg-[#D92332]/20 text-[#D92332] dark:text-[#F02D3A] text-[10px] px-2 py-1 rounded-full flex items-center gap-1"
            >
              <ArrowRightLeft className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{outboxCount}</span>
            </button>
          )}

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg bg-neutral-200/70 dark:bg-neutral-800 text-[#171717] dark:text-white ml-1"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Off-Canvas Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-white/95 dark:bg-[#101010]/95 backdrop-blur-md flex flex-col justify-between p-4 overflow-y-auto animate-in fade-in duration-150">
          <div>
            <div className="flex justify-between items-center pb-3 mb-3 border-b border-[#E8E8E8] dark:border-[#303030]">
              <span className="text-sm font-bold text-[#171717] dark:text-white">{user?.gym?.name}</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 text-[#707070] dark:text-[#A3A3A3] hover:text-[#171717] dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile Language & Branch Controls */}
            <div className="space-y-3 mb-4 p-3 bg-neutral-100 dark:bg-[#1C1C1C] rounded-xl border border-[#E8E8E8] dark:border-[#303030]">
              <div>
                <label className="text-[10px] font-semibold text-[#707070] dark:text-[#A3A3A3] uppercase tracking-wider block mb-1">
                  {t('auth.switch_language', 'Language')}
                </label>
                <LanguageSwitcher variant="pill" className="w-full justify-around" />
              </div>

              {user?.branches && user.branches.length > 0 && (
                <div>
                  <label className="text-[10px] font-semibold text-[#707070] dark:text-[#A3A3A3] uppercase tracking-wider block mb-1">
                    {t('members.assigned_branch', 'Select Branch')}
                  </label>
                  <select
                    value={activeBranchId || ''}
                    onChange={(e) => {
                      handleBranchChange(e);
                      setMobileMenuOpen(false);
                    }}
                    className="w-full bg-white dark:bg-[#141414] border border-[#E8E8E8] dark:border-[#303030] text-xs rounded-lg p-2 text-[#171717] dark:text-white"
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
                          ? 'bg-[#D92332]/10 dark:bg-[#F02D3A]/15 text-[#D92332] dark:text-[#F02D3A] font-bold'
                          : 'text-[#707070] dark:text-[#A3A3A3] hover:bg-neutral-200/50 dark:hover:bg-neutral-800'
                      }`}
                    >
                      <Icon className="w-4 h-4 text-[#D92332] dark:text-[#F02D3A]" />
                      <span>{t(dest.labelKey, dest.defaultLabel)}</span>
                    </Link>
                  );
                }

                return (
                  <div key={dest.id} className="space-y-0.5">
                    <button
                      onClick={() => toggleGroup(dest.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold ${
                        isActive
                          ? 'text-[#171717] dark:text-white bg-neutral-200/60 dark:bg-neutral-800/80'
                          : 'text-[#707070] dark:text-[#A3A3A3] hover:bg-neutral-200/40 dark:hover:bg-neutral-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4 text-[#D92332] dark:text-[#F02D3A]" />
                        <span>{t(dest.labelKey, dest.defaultLabel)}</span>
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 transition-transform duration-200 ${
                          isExpanded ? 'rotate-180 text-[#D92332] dark:text-[#F02D3A]' : 'text-[#707070] dark:text-[#A3A3A3]'
                        }`}
                      />
                    </button>

                    {isExpanded && (
                      <div className="pl-6 space-y-1 py-1 border-l border-[#E8E8E8] dark:border-[#303030] ml-4">
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
                                  ? 'bg-[#D92332]/10 dark:bg-[#F02D3A]/15 text-[#D92332] dark:text-[#F02D3A] font-bold'
                                  : 'text-[#707070] dark:text-[#A3A3A3] hover:text-[#171717] dark:hover:text-white hover:bg-neutral-200/40 dark:hover:bg-neutral-800/50'
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
          <div className="pt-4 mt-4 border-t border-[#E8E8E8] dark:border-[#303030] flex justify-between items-center">
            <div>
              <p className="text-xs font-semibold text-[#171717] dark:text-white">{user?.name}</p>
              <p className="text-[10px] text-[#707070] dark:text-[#A3A3A3] capitalize">{user?.role?.replace('_', ' ')}</p>
            </div>
            <button
              onClick={() => logout()}
              className="px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 text-xs font-semibold flex items-center gap-1.5"
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

      {/* Mobile Persistent Bottom Action Bar (Red & White in Light Mode / Red & Black in Dark Mode) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#F7F7F7]/95 dark:bg-[#1C1C1C]/95 backdrop-blur-md border-t border-[#E8E8E8] dark:border-[#303030] px-3 py-2 flex items-center justify-around shadow-[0_-8px_25px_rgba(0,0,0,0.08)] dark:shadow-[0_-8px_25px_rgba(0,0,0,0.6)] safe-bottom transition-colors">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex flex-col items-center justify-center min-w-[54px] py-1 text-[10px] font-semibold transition-colors cursor-pointer ${
              isActive ? 'text-[#D92332] dark:text-[#F02D3A] font-bold' : 'text-[#707070] dark:text-[#A3A3A3] hover:text-[#171717] dark:hover:text-white'
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
              isActive ? 'text-[#D92332] dark:text-[#F02D3A] font-bold' : 'text-[#707070] dark:text-[#A3A3A3] hover:text-[#171717] dark:hover:text-white'
            }`
          }
        >
          <CalendarCheck className="w-5 h-5 mb-0.5" />
          <span>{t('nav.bottom_attendance', 'Attendance')}</span>
        </NavLink>

        {/* Center Floating Quick Action Button */}
        <button
          onClick={() => setQuickActionsOpen(true)}
          className="flex flex-col items-center justify-center -mt-5 bg-gradient-to-tr from-[#D92332] to-[#B91C2B] dark:from-[#F02D3A] dark:to-[#FF4652] text-white w-12 h-12 rounded-full shadow-lg shadow-red-600/40 font-bold cursor-pointer hover:scale-105 active:scale-95 transition-all"
          title={t('nav.bottom_quick', 'Quick Actions')}
        >
          <Zap className="w-6 h-6 fill-white text-white" />
        </button>

        <NavLink
          to="/members"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center min-w-[54px] py-1 text-[10px] font-semibold transition-colors cursor-pointer ${
              isActive ? 'text-[#D92332] dark:text-[#F02D3A] font-bold' : 'text-[#707070] dark:text-[#A3A3A3] hover:text-[#171717] dark:hover:text-white'
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
              isActive ? 'text-[#D92332] dark:text-[#F02D3A] font-bold' : 'text-[#707070] dark:text-[#A3A3A3] hover:text-[#171717] dark:hover:text-white'
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
