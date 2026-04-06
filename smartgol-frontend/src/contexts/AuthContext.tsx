import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { PlanType } from '../types';
import * as authApi from '../api/auth';

const TOKEN_KEY = 'token';
const PLAN_KEY = 'plan';
const ADMIN_KEY = 'isAdmin';

interface AuthContextValue {
  token: string | null;
  plan: PlanType | null;
  isAdmin: boolean;
  isLoggedIn: boolean;
  login: (email: string, password: string) => Promise<{ isAdmin: boolean }>;
  register: (email: string, password: string) => Promise<{ isAdmin: boolean }>;
  logout: () => void;
  setPlan: (plan: PlanType) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [plan, setPlanState] = useState<PlanType | null>(() =>
    (localStorage.getItem(PLAN_KEY) as PlanType) || null
  );
  const [isAdmin, setIsAdmin] = useState<boolean>(() =>
    localStorage.getItem(ADMIN_KEY) === 'true'
  );

  const setPlan = useCallback((p: PlanType) => {
    setPlanState(p);
    localStorage.setItem(PLAN_KEY, p);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { access_token, plan: p, isAdmin: admin } = await authApi.login(email, password);
    setToken(access_token);
    setPlanState(p);
    setIsAdmin(!!admin);
    localStorage.setItem(TOKEN_KEY, access_token);
    localStorage.setItem(PLAN_KEY, p);
    if (admin) localStorage.setItem(ADMIN_KEY, 'true');
    else localStorage.removeItem(ADMIN_KEY);
    return { isAdmin: !!admin };
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    await authApi.register(email, password);
    return login(email, password);
  }, [login]);

  const logout = useCallback(() => {
    setToken(null);
    setPlanState(null);
    setIsAdmin(false);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(PLAN_KEY);
    localStorage.removeItem(ADMIN_KEY);
  }, []);

  const value: AuthContextValue = {
    token,
    plan,
    isAdmin,
    isLoggedIn: !!token,
    login,
    register,
    logout,
    setPlan,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
