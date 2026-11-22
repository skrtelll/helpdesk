"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ApiError, clearTokens, hasCredentials, setUnauthorizedHandler } from "@/shared/api";
import { ROUTES } from "@/shared/config";
import { getMe } from "../api/userApi";
import type { User } from "./types";

interface Session {
  user: User | null;
  /** идёт загрузка текущего пользователя */
  loading: boolean;
  /** не удалось загрузить пользователя (не 401): нет связи, 5xx */
  error: unknown;
  setUser: (user: User | null) => void;
  reload: () => void;
}

const Ctx = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(undefined);
  const [tick, setTick] = useState(0);

  // Refresh не удался: сессия закончилась, возвращаем на вход.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      router.replace(ROUTES.login);
    });
  }, [router]);

  useEffect(() => {
    if (!hasCredentials()) {
      setUser(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(undefined);
    getMe()
      .then((u) => {
        if (!cancelled) setUser(u);
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) {
          clearTokens();
          setUser(null);
        } else {
          setError(e);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const value = useMemo<Session>(() => ({ user, loading, error, setUser, reload: () => setTick((t) => t + 1) }), [user, loading, error]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): Session {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession вне SessionProvider");
  return v;
}
