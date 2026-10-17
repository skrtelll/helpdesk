"use client";

import { useState, type FormEvent } from "react";
import Protected from "@/components/Protected";
import { useAuth } from "@/lib/auth";
import { ROLE_LABEL, errorText } from "@/lib/labels";

function Profile() {
  const { user, rename } = useAuth();
  const [name, setName] = useState(user?.displayName ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await rename(name);
      setMsg({ ok: true, text: "Сохранено" });
    } catch (err) {
      setMsg({ ok: false, text: errorText(err) });
    }
  }

  if (!user) return null;
  return (
    <div className="card narrow">
      <h1>Профиль</h1>
      <p className="muted">{user.email} · {ROLE_LABEL[user.role]}</p>
      {msg && <div className={`alert ${msg.ok ? "ok" : "error"}`}>{msg.text}</div>}
      <form onSubmit={submit} className="stack-sm">
        <label>Имя<input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} /></label>
        <div><button className="btn primary" type="submit">Сохранить</button></div>
      </form>
    </div>
  );
}

export default function ProfilePage() {
  return <Protected><Profile /></Protected>;
}
