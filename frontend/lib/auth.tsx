"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";
import { setUnauthorizedHandler } from "./api/http";
import { clearTokens, getTokens } from "./api/tokens";
import type { Role, User } from "./types";

interface AuthState {
  user: User | null;
  loading: boolean;
  login(email: string, password: string): Promise<User>;
  register(email: string, password: string, displayName: string): Promise<User>;
  logout(): Promise<void>;
  rename(displayName: string): Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function homePath(role: Role): string {
  return role === "USER" ? "/tickets" : "/support/queue";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      router.replace("/login");
    });
  }, [router]);

  useEffect(() => {
    if (!getTokens()) {
      setLoading(false);
      return;
    }
    api.me().then(setUser).catch(() => clearTokens()).finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await api.login(email, password);
    const me = await api.me();
    setUser(me);
    return me;
  }, []);

  const register = useCallback(async (email: string, password: string, displayName: string) => {
    await api.register(email, password, displayName);
    return login(email, password);
  }, [login]);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* токен всё равно очищаем */
    }
    clearTokens();
    setUser(null);
    router.replace("/login");
  }, [router]);

  const rename = useCallback(async (displayName: string) => {
    setUser(await api.updateMe(displayName));
  }, []);

  const value = useMemo(() => ({ user, loading, login, register, logout, rename }), [user, loading, login, register, logout, rename]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth вне AuthProvider");
  return v;
}
