"use client";

import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { EVENT_LABEL, PRIORITY_LABEL, ROLE_LABEL, errorText, fmtDate, transitionLabel } from "@/lib/labels";
import { PRIORITIES, TERMINAL, type Category, type Priority, type Status } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";
import { nextStatuses } from "@/lib/workflow";
import { PriorityBadge, StatusBadge } from "./Badges";
import { Empty, ErrorBox, Loading } from "./States";

export default function TicketView({ id }: { id: string }) {
  const { user } = useAuth();
  const staff = !!user && user.role !== "USER";
  const admin = user?.role === "ADMIN";

  const ticket = useAsync(() => api.getTicket(id), [id]);
  const comments = useAsync(() => api.listComments(id), [id]);
  const history = useAsync(() => api.listHistory(id), [id]);
  const categories = useAsync(() => (staff ? api.listCategories() : Promise.resolve([] as Category[])), [staff]);
  const users = useAsync(() => (admin ? api.listUsers({ size: 100 }) : Promise.resolve(null)), [admin]);

  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  if (!user) return null;
  if (ticket.loading && !ticket.data) return <Loading />;
  if (ticket.error || !ticket.data) return <ErrorBox error={ticket.error} onRetry={ticket.reload} />;

  const t = ticket.data;
  const terminal = TERMINAL.includes(t.status);
  const transitions: Status[] = nextStatuses(user, t.author.id, t.status);
  const canTake = staff && t.status === "NEW" && !t.assignee;
  const assignable = (users.data?.items ?? []).filter((u) => u.enabled && u.role !== "USER");

  function reloadAll() {
    ticket.reload();
    comments.reload();
    history.reload();
  }

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
    } catch (e) {
      setActionError(errorText(e));
    } finally {
      setBusy(false);
      reloadAll();
    }
  }

  async function submitComment(e: FormEvent) {
    e.preventDefault();
    setCommentError(null);
    if (!body.trim()) {
      setCommentError("Комментарий не может быть пустым");
      return;
    }
    setBusy(true);
    try {
      await api.addComment(t.id, body, staff && internal);
      setBody("");
      setInternal(false);
    } catch (err) {
      setCommentError(errorText(err));
    } finally {
      setBusy(false);
      reloadAll();
    }
  }

  return (
    <div className="stack">
      <div className="card">
        <p className="muted">{t.number}</p>
        <h1>{t.title}</h1>
        <p><StatusBadge status={t.status} /> <PriorityBadge priority={t.priority} /></p>
        <dl className="meta">
          <div><dt>Автор</dt><dd>{t.author.displayName}</dd></div>
          <div><dt>Исполнитель</dt><dd>{t.assignee?.displayName ?? "не назначен"}</dd></div>
          <div><dt>Категория</dt><dd>{t.category.name}</dd></div>
          <div><dt>Создана</dt><dd>{fmtDate(t.createdAt)}</dd></div>
          <div><dt>Обновлена</dt><dd>{fmtDate(t.updatedAt)}</dd></div>
          {t.resolvedAt && <div><dt>Решена</dt><dd>{fmtDate(t.resolvedAt)}</dd></div>}
          {t.closedAt && <div><dt>Закрыта</dt><dd>{fmtDate(t.closedAt)}</dd></div>}
          {t.cancelledAt && <div><dt>Отменена</dt><dd>{fmtDate(t.cancelledAt)}</dd></div>}
        </dl>
        <h2>Описание</h2>
        <p className="pre">{t.description}</p>
      </div>

      {!terminal && (canTake || transitions.length > 0 || staff) && (
        <div className="card">
          <h2>Действия</h2>
          {actionError && <div className="alert error" role="alert">{actionError}</div>}
          <div className="row">
            {canTake && <button className="btn primary" disabled={busy} onClick={() => run(() => api.takeTicket(t.id, t.version))}>Взять в работу</button>}
            {transitions.map((s) => (
              <button key={s} className={`btn${s === "CANCELLED" ? " danger" : ""}`} disabled={busy} onClick={() => run(() => api.changeStatus(t.id, s, t.version))}>
                {transitionLabel(t.status, s)}
              </button>
            ))}
          </div>
          {staff && (
            <div className="filters" style={{ marginTop: 16 }}>
              <label>Категория
                <select value={t.category.id} disabled={busy} onChange={(e) => run(() => api.updateTicket(t.id, { categoryId: e.target.value }, t.version))}>
                  {(categories.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  {!(categories.data ?? []).some((c) => c.id === t.category.id) && <option value={t.category.id}>{t.category.name}</option>}
                </select>
              </label>
              <label>Приоритет
                <select value={t.priority} disabled={busy} onChange={(e) => run(() => api.updateTicket(t.id, { priority: e.target.value as Priority }, t.version))}>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
                </select>
              </label>
              {admin && (
                <label>Исполнитель
                  <select value={t.assignee?.id ?? ""} disabled={busy} onChange={(e) => e.target.value && run(() => api.assignTicket(t.id, e.target.value, t.version))}>
                    <option value="">— выберите —</option>
                    {assignable.map((u) => <option key={u.id} value={u.id}>{u.displayName} ({ROLE_LABEL[u.role]})</option>)}
                  </select>
                </label>
              )}
            </div>
          )}
        </div>
      )}

      <div className="card">
        <h2>Комментарии</h2>
        {comments.loading && !comments.data ? <Loading /> : comments.error ? <ErrorBox error={comments.error} onRetry={comments.reload} /> : (comments.data ?? []).length === 0 ? (
          <Empty>Комментариев пока нет.</Empty>
        ) : (
          <ul className="comments">
            {(comments.data ?? []).map((c) => (
              <li key={c.id} className={c.internal ? "internal" : undefined}>
                <div className="muted">
                  <strong>{c.author.displayName}</strong> · {ROLE_LABEL[c.authorRole]} · {fmtDate(c.createdAt)}
                  {c.internal && <span className="badge internal-badge">внутренний</span>}
                </div>
                <p className="pre">{c.body}</p>
              </li>
            ))}
          </ul>
        )}
        {terminal ? (
          <p className="muted">Заявка закрыта или отменена: комментарии недоступны.</p>
        ) : (
          <form onSubmit={submitComment} className="stack-sm">
            {commentError && <div className="alert error" role="alert">{commentError}</div>}
            <label>Новый комментарий
              <textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
            </label>
            {staff && (
              <label className="check">
                <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} /> Внутренний (виден только поддержке)
              </label>
            )}
            <div><button className="btn primary" type="submit" disabled={busy}>Отправить</button></div>
          </form>
        )}
      </div>

      <div className="card">
        <h2>История</h2>
        {history.loading && !history.data ? <Loading /> : history.error ? <ErrorBox error={history.error} onRetry={history.reload} /> : (history.data ?? []).length === 0 ? (
          <Empty>История пуста.</Empty>
        ) : (
          <ul className="history">
            {(history.data ?? []).map((h) => (
              <li key={h.id}>
                <span className="muted">{fmtDate(h.createdAt)}</span> · <strong>{EVENT_LABEL[h.type]}</strong>
                {(h.oldValue || h.newValue) && <> — {h.oldValue ?? "∅"} → {h.newValue ?? "∅"}</>}
                <span className="muted"> · {h.actor.displayName}</span>
                {h.internal && <span className="badge internal-badge">внутренняя</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
