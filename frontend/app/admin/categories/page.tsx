"use client";

import { useState, type FormEvent } from "react";
import Protected from "@/components/Protected";
import { Empty, ErrorBox, Loading } from "@/components/States";
import { ApiError, api } from "@/lib/api";
import { errorText } from "@/lib/labels";
import type { Category } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";

function Row({ c, onChanged, onError }: { c: Category; onChanged: () => void; onError: (m: string | null) => void }) {
  const [name, setName] = useState(c.name);
  const [description, setDescription] = useState(c.description ?? "");
  const [busy, setBusy] = useState(false);
  const dirty = name !== c.name || description !== (c.description ?? "");

  async function save(patch: { name?: string; description?: string; active?: boolean }) {
    setBusy(true);
    onError(null);
    try {
      await api.updateCategory(c.id, patch);
    } catch (e) {
      onError(errorText(e));
    } finally {
      setBusy(false);
      onChanged();
    }
  }

  return (
    <tr className={c.active ? undefined : "inactive"}>
      <td><code>{c.code}</code></td>
      <td><input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} /></td>
      <td><input value={description} onChange={(e) => setDescription(e.target.value)} /></td>
      <td>{c.active ? "да" : "нет"}</td>
      <td className="row">
        <button className="btn small" disabled={busy || !dirty} onClick={() => save({ name, description })}>Сохранить</button>
        <button className="btn small" disabled={busy} onClick={() => save({ active: !c.active })}>{c.active ? "Деактивировать" : "Активировать"}</button>
      </td>
    </tr>
  );
}

function Categories() {
  const list = useAsync(() => api.listCategories(true), []);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});

  async function create(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFields({});
    try {
      await api.createCategory({ code: code.trim().toUpperCase(), name, description });
      setCode("");
      setName("");
      setDescription("");
      list.reload();
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) setFields(err.fieldErrors);
      setError(errorText(err));
    }
  }

  return (
    <div className="stack">
      <h1>Категории</h1>
      <p className="muted">Категории не удаляются, только деактивируются. Код существующей категории изменить нельзя.</p>
      {error && <div className="alert error" role="alert">{error}</div>}
      {list.loading && !list.data ? <Loading /> : list.error ? <ErrorBox error={list.error} onRetry={list.reload} /> : !list.data || list.data.length === 0 ? (
        <Empty>Категорий нет.</Empty>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Код</th><th>Название</th><th>Описание</th><th>Активна</th><th /></tr></thead>
            <tbody>{list.data.map((c) => <Row key={c.id + c.name + c.active} c={c} onChanged={list.reload} onError={setError} />)}</tbody>
          </table>
        </div>
      )}
      <form onSubmit={create} className="card stack-sm">
        <h2>Новая категория</h2>
        <label>Код (A–Z, 0–9, _)<input value={code} maxLength={50} onChange={(e) => setCode(e.target.value)} />{fields.code && <span className="field-error">{fields.code}</span>}</label>
        <label>Название<input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />{fields.name && <span className="field-error">{fields.name}</span>}</label>
        <label>Описание<input value={description} onChange={(e) => setDescription(e.target.value)} /></label>
        <div><button className="btn primary" type="submit">Создать</button></div>
      </form>
    </div>
  );
}

export default function AdminCategoriesPage() {
  return <Protected roles={["ADMIN"]}><Categories /></Protected>;
}
