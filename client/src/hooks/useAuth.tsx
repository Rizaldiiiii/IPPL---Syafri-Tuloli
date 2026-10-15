import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { UserDTO } from '@gantt/shared';
import { apiFetch, getToken, setToken } from '../api/client.js';

interface AuthContextValue {
  user: UserDTO | null;
  status: 'loading' | 'authenticated' | 'anonymous';
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

interface AuthResponse {
  token: string;
  user: UserDTO;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<UserDTO | null>(null);
  const [status, setStatus] = useState<AuthContextValue['status']>(() =>
    getToken() ? 'loading' : 'anonymous',
  );

  useEffect(() => {
    if (!getToken()) {
      setStatus('anonymous');
      return;
    }
    let cancelled = false;
    apiFetch<{ user: UserDTO }>('/auth/me')
      .then((response) => {
        if (cancelled) return;
        setUser(response.user);
        setStatus('authenticated');
      })
      .catch(() => {
        if (cancelled) return;
        setToken(null);
        setUser(null);
        setStatus('anonymous');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await apiFetch<AuthResponse>('/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      setToken(response.token);
      setUser(response.user);
      setStatus('authenticated');
      queryClient.clear();
    },
    [queryClient],
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const response = await apiFetch<AuthResponse>('/auth/register', {
        method: 'POST',
        body: { name, email, password },
      });
      setToken(response.token);
      setUser(response.user);
      setStatus('authenticated');
      queryClient.clear();
    },
    [queryClient],
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setStatus('anonymous');
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, login, register, logout }),
    [user, status, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth harus dipakai di dalam AuthProvider');
  return context;
}
