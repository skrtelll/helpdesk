"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import { homePath, useAuth } from "@/lib/auth";
import { errorText } from "@/lib/labels";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const errs: Record<string, string> = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) errs.email = "Некорректный email";
    if (password.length < 8) errs.password = "Минимум 8 символов";
    if (displayName.trim().length < 1 || displayName.length > 100) errs.displayName = "От 1 до 100 символов";
    setFields(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    try {
      const me = await register(email.trim(), password, displayName.trim());
      router.replace(homePath(me.role));
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) setFields(err.fieldErrors);
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container narrow">
      <div className="card">
        <h1>Регистрация</h1>
        {error && <div className="alert error" role="alert">{error}</div>}
        <form onSubmit={submit} className="stack-sm" noValidate>
          <label>Имя<input value={displayName} maxLength={100} onChange={(e) => setDisplayName(e.target.value)} />{fields.displayName && <span className="field-error">{fields.displayName}</span>}</label>
          <label>Email<input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />{fields.email && <span className="field-error">{fields.email}</span>}</label>
          <label>Пароль (не короче 8 символов)<input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />{fields.password && <span className="field-error">{fields.password}</span>}</label>
          <button className="btn primary" type="submit" disabled={busy}>{busy ? "Создаём…" : "Зарегистрироваться"}</button>
        </form>
        <p>Уже есть аккаунт? <Link href="/login">Войти</Link></p>
      </div>
    </main>
  );
}
