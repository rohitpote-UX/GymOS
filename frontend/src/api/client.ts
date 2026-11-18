import axios, { type AxiosError } from 'axios';

const TOKEN_KEY = 'gym_token';
const ACTIVE_BRANCH_KEY = 'gym_active_branch_id';
const LOGOUT_REASON_KEY = 'gym_logout_reason';

export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string, remember: boolean): void {
    try {
      this.clear();
      (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
    } catch {
      // storage quota or blocked
    }
  },
  clear(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      // ignore
    }
  },
};

export const branchStore = {
  get(): number | null {
    try {
      const val = localStorage.getItem(ACTIVE_BRANCH_KEY);
      return val ? parseInt(val, 10) : null;
    } catch {
      return null;
    }
  },
  set(branchId: number | null): void {
    try {
      if (branchId) {
        localStorage.setItem(ACTIVE_BRANCH_KEY, branchId.toString());
      } else {
        localStorage.removeItem(ACTIVE_BRANCH_KEY);
      }
    } catch {
      // ignore
    }
  },
};

export function takeLogoutReason(): string | null {
  try {
    const reason = sessionStorage.getItem(LOGOUT_REASON_KEY);
    sessionStorage.removeItem(LOGOUT_REASON_KEY);
    return reason;
  } catch {
    return null;
  }
}

const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || '') + '/api',
  headers: {
    Accept: 'application/json',
  },
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    config.headers['X-Auth-Token'] = token;
  }

  const branchId = branchStore.get();
  if (branchId) {
    config.headers['X-Branch-ID'] = branchId;
  }

  return config;
});

let onUnauthorizedCallback = () => {};
let onExpiredCallback = () => {};

export function setUnauthorizedHandler(fn: () => void): void {
  onUnauthorizedCallback = fn;
}

export function setExpiredHandler(fn: () => void): void {
  onExpiredCallback = fn;
}

api.interceptors.response.use(
  (res) => res,
  (err: AxiosError<{ message?: string; code?: string }>) => {
    const status = err.response?.status;
    const code = err.response?.data?.code;

    if (status === 401 && !err.config?.url?.endsWith('/login') && !err.config?.url?.endsWith('/register')) {
      onUnauthorizedCallback();
    }

    if (status === 403 && (code === 'gym_suspended' || code === 'user_inactive' || code === 'no_gym')) {
      try {
        sessionStorage.setItem(LOGOUT_REASON_KEY, err.response?.data?.message || 'Access blocked.');
      } catch {
        // ignore
      }
      onUnauthorizedCallback();
    }

    if (status === 403 && code === 'gym_expired') {
      onExpiredCallback();
    }

    return Promise.reject(err);
  }
);

export function isNetworkError(err: unknown): boolean {
  if (axios.isAxiosError(err)) {
    return !err.response && (err.code === 'ERR_NETWORK' || err.code === 'ECONNABORTED' || !navigator.onLine);
  }
  return !navigator.onLine;
}

export function errorMessage(err: unknown): string {
  if (isNetworkError(err)) {
    return 'Network connection unavailable. Changes will be saved offline.';
  }

  if (axios.isAxiosError(err) && err.response?.data) {
    const data = err.response.data as { message?: string; errors?: Record<string, string[]> };
    if (err.response.status === 422 && data.errors) {
      const first = Object.values(data.errors)[0];
      if (Array.isArray(first) && first[0]) return first[0];
    }
    if (data.message) {
      return data.message;
    }
  }

  return 'Something went wrong. Please try again.';
}

export { api };
export default api;
