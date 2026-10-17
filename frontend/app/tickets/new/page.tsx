"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Protected from "@/components/Protected";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { errorText } from "@/lib/labels";

function NewTicket() {
  const { user } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const errs: Record<string, string> = {};
    if (title.trim().length < 1 || title.length > 200) errs.title = "От 1 до 200 символов";
    if (description.trim().length < 1) errs.description = "Опишите проблему";
    setFields(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    try {
      const t = await api.createTicket({ title, description });
      router.replace(user && user.role !== "USER" ? `/support/tickets/${t.id}` : `/tickets/${t.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) setFields(err.fieldErrors);
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <div className="card narrow">
      <h1>Новая заявка</h1>
      {error && <div className="alert error" role="alert">{error}</div>}
      <form onSubmit={submit} className="stack-sm" noValidate>
        <label>Тема ({title.length}/200)
          <input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
          {fields.title && <span className="field-error">{fields.title}</span>}
        </label>
        <label>Описание
          <textarea rows={7} value={description} onChange={(e) => setDescription(e.target.value)} />
          {fields.description && <span className="field-error">{fields.description}</span>}
        </label>
        <p className="muted">Категорию и приоритет выставит сотрудник поддержки.</p>
        <div><button className="btn primary" type="submit" disabled={busy}>{busy ? "Создаём…" : "Создать заявку"}</button></div>
      </form>
    </div>
  );
}

export default function NewTicketPage() {
  return <Protected><NewTicket /></Protected>;
}
