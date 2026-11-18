import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import i18n from '../i18n';
import api, {
  branchStore,
  setExpiredHandler,
  setUnauthorizedHandler,
  tokenStore,
} from '../api/client';
import { getOutboxItems, subscribeOutbox, syncOutbox } from '../lib/outbox';

export interface BranchInfo {
  id: number;
  name: string;
  code?: string;
  is_primary?: boolean;
  city?: string;
}

export interface GymInfo {
  id: number;
  name: string;
  slug: string;
  currency: string;
  status: 'active' | 'suspended' | 'trial';
  is_trial: boolean;
  trial_ends_at?: string;
  subscription_expires_at?: string;
  expired: boolean;
  branding?: {
    primary_color?: string;
    accent_color?: string;
    tagline?: string;
  };
  settings?: Record<string, unknown>;
  assets_version?: number;
}

export interface UserInfo {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role:
    | 'super_admin'
    | 'gym_owner'
    | 'branch_manager'
    | 'trainer'
    | 'receptionist'
    | 'front_desk'
    | 'accountant'
    | 'inventory_manager'
    | 'member';
  avatar_url?: string;
  language?: string;
  primary_branch_id?: number;
  branches?: BranchInfo[];
  permissions?: string[];
  impersonating?: boolean;
  gym?: GymInfo | null;
}

interface AuthContextType {
  user: UserInfo | null;
  activeBranchId: number | null;
  activeBranch: BranchInfo | null;
  setActiveBranchId: (branchId: number) => void;
  login: (loginId: string, password: string, remember?: boolean) => Promise<void>;
  registerGym: (data: Record<string, unknown>) => Promise<void>;
  logout: () => Promise<void>;
  setLanguage: (lang: 'en' | 'mr' | 'hi') => Promise<void>;
  impersonate: (gymId: number) => Promise<void>;
  stopImpersonating: () => Promise<void>;
  refreshMe: () => Promise<void>;
  isOnline: boolean;
  outboxCount: number;
  isSyncing: boolean;
  triggerSync: () => Promise<number>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const USER_KEY = 'gym_cached_user';
const ADMIN_BACKUP_KEY = 'gym_admin_backup';

function loadCachedUser(): UserInfo | null {
  try {
    const raw = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persistUser(user: UserInfo | null, remember: boolean): void {
  try {
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(USER_KEY);
    if (user) {
      (remember ? localStorage : sessionStorage).setItem(USER_KEY, JSON.stringify(user));
    }
  } catch {
    // ignore
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserInfo | null>(() => (tokenStore.get() ? loadCachedUser() : null));
  const [activeBranchId, setActiveBranchIdState] = useState<number | null>(() => branchStore.get());
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [outboxCount, setOutboxCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Monitor network online/offline events
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubscribe = subscribeOutbox((items, syncing) => {
      setOutboxCount(items.length);
      setIsSyncing(syncing);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, []);

  const setActiveBranchId = useCallback((id: number) => {
    branchStore.set(id);
    setActiveBranchIdState(id);
  }, []);

  const clearSession = useCallback(() => {
    tokenStore.clear();
    branchStore.set(null);
    persistUser(null, false);
    sessionStorage.removeItem(ADMIN_BACKUP_KEY);
    setUser(null);
    setActiveBranchIdState(null);
  }, []);

  const refreshMe = useCallback(async () => {
    if (!tokenStore.get()) return;
    try {
      const { data } = await api.get<{ user: UserInfo }>('/me');
      const remember = Boolean(localStorage.getItem(USER_KEY));
      persistUser(data.user, remember);
      setUser(data.user);

      if (data.user.language && ['en', 'mr', 'hi'].includes(data.user.language)) {
        i18n.changeLanguage(data.user.language);
        localStorage.setItem('gym_user_language', data.user.language);
      }

      // Auto-select primary branch if active branch not set or invalid
      const currentStored = branchStore.get();
      const validBranches = data.user.branches || [];
      const hasValidBranch = validBranches.some((b) => b.id === currentStored);

      if (!hasValidBranch && validBranches.length > 0) {
        const primary = validBranches.find((b) => b.is_primary) || validBranches[0];
        setActiveBranchId(primary.id);
      }
    } catch {
      // offline: keep cached user
    }
  }, [setActiveBranchId]);

  useEffect(() => {
    setUnauthorizedHandler(clearSession);
    setExpiredHandler(refreshMe);
  }, [clearSession, refreshMe]);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  const login = async (loginId: string, password: string, remember = false) => {
    const { data } = await api.post<{ token: string; user: UserInfo }>('/login', {
      login: loginId,
      password,
      remember,
    });
    tokenStore.set(data.token, remember);
    persistUser(data.user, remember);
    setUser(data.user);

    if (data.user.language && ['en', 'mr', 'hi'].includes(data.user.language)) {
      i18n.changeLanguage(data.user.language);
      localStorage.setItem('gym_user_language', data.user.language);
    }

    if (data.user.branches && data.user.branches.length > 0) {
      const primary = data.user.branches.find((b) => b.is_primary) || data.user.branches[0];
      setActiveBranchId(primary.id);
    }
  };

  const registerGym = async (payload: Record<string, unknown>) => {
    const { data } = await api.post<{ token: string; user: UserInfo }>('/register', payload);
    tokenStore.set(data.token, true);
    persistUser(data.user, true);
    setUser(data.user);

    if (data.user.language && ['en', 'mr', 'hi'].includes(data.user.language)) {
      i18n.changeLanguage(data.user.language);
      localStorage.setItem('gym_user_language', data.user.language);
    }

    if (data.user.branches && data.user.branches.length > 0) {
      setActiveBranchId(data.user.branches[0].id);
    }
  };

  const setLanguage = useCallback(async (lang: 'en' | 'mr' | 'hi') => {
    i18n.changeLanguage(lang);
    localStorage.setItem('gym_user_language', lang);
    if (user) {
      const updatedUser: UserInfo = { ...user, language: lang };
      setUser(updatedUser);
      const remember = Boolean(localStorage.getItem(USER_KEY));
      persistUser(updatedUser, remember);
      try {
        await api.put('/me/language', { language: lang });
      } catch {
        // offline or transient error; client state already updated
      }
    }
  }, [user]);

  const logout = async () => {
    const backupAdmin = sessionStorage.getItem(ADMIN_BACKUP_KEY);
    try {
      await api.post('/logout');
    } catch {
      // token may already be revoked
    }

    if (backupAdmin) {
      // If super admin was impersonating, return to admin session
      try {
        const adminSession = JSON.parse(backupAdmin);
        sessionStorage.removeItem(ADMIN_BACKUP_KEY);
        tokenStore.set(adminSession.token, Boolean(adminSession.remember));
        persistUser(adminSession.user, Boolean(adminSession.remember));
        setUser(adminSession.user);
        return;
      } catch {
        // fallthrough to clear
      }
    }

    clearSession();
  };

  const impersonate = async (gymId: number) => {
    const currentToken = tokenStore.get();
    if (currentToken && user) {
      sessionStorage.setItem(
        ADMIN_BACKUP_KEY,
        JSON.stringify({ token: currentToken, user, remember: Boolean(localStorage.getItem(USER_KEY)) })
      );
    }

    const { data } = await api.post<{ token: string; user: UserInfo }>(`/admin/gyms/${gymId}/impersonate`);
    tokenStore.set(data.token, false);
    persistUser(data.user, false);
    setUser(data.user);

    if (data.user.branches && data.user.branches.length > 0) {
      setActiveBranchId(data.user.branches[0].id);
    }
  };

  const stopImpersonating = () => logout();

  const triggerSync = async () => {
    return await syncOutbox();
  };

  const activeBranch = user?.branches?.find((b) => b.id === activeBranchId) || null;

  return (
    <AuthContext.Provider
      value={{
        user,
        activeBranchId,
        activeBranch,
        setActiveBranchId,
        login,
        registerGym,
        logout,
        setLanguage,
        impersonate,
        stopImpersonating,
        refreshMe,
        isOnline,
        outboxCount,
        isSyncing,
        triggerSync,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
