import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, ApiError } from './api';

export interface Session {
  usuario: string;
  rol: 'Rolemaster' | 'Consulta';
  nombre: string;
  secondsLeft: number;
}

interface AuthState {
  session: Session | null;
  loading: boolean;
  login: (usuario: string, clave: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const me = await api.get<Session>('/auth/me');
      setSession(me);
    } catch {
      setSession(null);
    }
  }, []);

  useEffect(() => {
    refreshSession().finally(() => setLoading(false));
  }, [refreshSession]);

  useEffect(() => {
    if (!session) return;
    const id = setInterval(() => {
      setSession((s) => (s ? { ...s, secondsLeft: Math.max(0, s.secondsLeft - 30) } : s));
    }, 30_000);
    return () => clearInterval(id);
  }, [session?.usuario]);

  useEffect(() => {
    if (session && session.secondsLeft <= 0) setSession(null);
  }, [session?.secondsLeft]);

  const login = useCallback(async (usuario: string, clave: string) => {
    const res = await api.post<{ usuario: string; rol: 'Rolemaster' | 'Consulta'; nombre: string }>('/auth/login', { usuario, clave });
    setSession({ ...res, secondsLeft: 60 * 60 });
    await refreshSession();
  }, [refreshSession]);

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => {});
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider value={{ session, loading, login, logout, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}

export { ApiError };
