"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isMock } from "@/lib/api";
import { resetMockData } from "@/lib/api/mock";
import { homePath, useAuth } from "@/lib/auth";
import { errorText } from "@/lib/labels";

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace(homePath(user.role));
  }, [loading, user, router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const me = await login(email.trim(), password);
      router.replace(homePath(me.role));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container narrow">
      <div className="card">
        <h1>Вход в HelpDesk</h1>
        {error && <div className="alert error" role="alert">{error}</div>}
        <form onSubmit={submit} className="stack-sm">
          <label>Email<input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label>Пароль<input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          <button className="btn primary" type="submit" disabled={busy}>{busy ? "Входим…" : "Войти"}</button>
        </form>
        <p>Нет аккаунта? <Link href="/register">Зарегистрироваться</Link></p>
        {isMock && (
          <div className="hint">
            <strong>Демо-режим (без backend).</strong> Пароль у всех <code>password123</code>:
            <ul>
              <li><code>user@helpdesk.test</code> — USER</li>
              <li><code>support@helpdesk.test</code> — SUPPORT</li>
              <li><code>admin@helpdesk.test</code> — ADMIN</li>
            </ul>
            <button className="btn small" type="button" onClick={() => { resetMockData(); window.location.reload(); }}>Сбросить демо-данные</button>
          </div>
        )}
      </div>
    </main>
  );
}
