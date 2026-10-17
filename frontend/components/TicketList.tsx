"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { PRIORITIES, STATUSES, type Page, type Priority, type Status, type Ticket, type TicketQuery } from "@/lib/types";
import { PRIORITY_LABEL, STATUS_LABEL, fmtDate } from "@/lib/labels";
import { useAsync } from "@/lib/useAsync";
import { PriorityBadge, StatusBadge } from "./Badges";
import Pagination from "./Pagination";
import { Empty, ErrorBox, Loading } from "./States";

interface Props {
  fetcher: (q: TicketQuery) => Promise<Page<Ticket>>;
  detailBase: string; // "/tickets" или "/support/tickets"
  emptyText: string;
  statusFilter?: boolean;
  unassignedFilter?: boolean;
  showAuthor?: boolean;
}

export default function TicketList({ fetcher, detailBase, emptyText, statusFilter = true, unassignedFilter = false, showAuthor = false }: Props) {
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState<Status | "">("");
  const [priority, setPriority] = useState<Priority | "">("");
  const [categoryId, setCategoryId] = useState("");
  const [unassigned, setUnassigned] = useState(false);

  const cats = useAsync(() => api.listCategories(), []);
  const list = useAsync(
    () => fetcher({ page, size: 10, status: status || undefined, priority: priority || undefined, categoryId: categoryId || undefined, unassigned: unassigned || undefined }),
    [page, status, priority, categoryId, unassigned],
  );

  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(0);
  };

  return (
    <div>
      <div className="filters">
        {statusFilter && (
          <label>Статус
            <select value={status} onChange={(e) => reset(setStatus)(e.target.value as Status | "")}>
              <option value="">Все</option>
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </label>
        )}
        <label>Приоритет
          <select value={priority} onChange={(e) => reset(setPriority)(e.target.value as Priority | "")}>
            <option value="">Все</option>
            {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
          </select>
        </label>
        <label>Категория
          <select value={categoryId} onChange={(e) => reset(setCategoryId)(e.target.value)}>
            <option value="">Все</option>
            {(cats.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        {unassignedFilter && (
          <label className="check">
            <input type="checkbox" checked={unassigned} onChange={(e) => reset(setUnassigned)(e.target.checked)} /> Только без исполнителя
          </label>
        )}
      </div>

      {list.loading && !list.data ? <Loading /> : list.error ? <ErrorBox error={list.error} onRetry={list.reload} /> : !list.data || list.data.items.length === 0 ? (
        <Empty>{emptyText}</Empty>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>№</th><th>Тема</th><th>Статус</th><th>Приоритет</th><th>Категория</th>
                  {showAuthor && <th>Автор</th>}
                  <th>Исполнитель</th><th>Обновлена</th>
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((t) => (
                  <tr key={t.id}>
                    <td><Link href={`${detailBase}/${t.id}`}>{t.number}</Link></td>
                    <td><Link href={`${detailBase}/${t.id}`}>{t.title}</Link></td>
                    <td><StatusBadge status={t.status} /></td>
                    <td><PriorityBadge priority={t.priority} /></td>
                    <td>{t.category.name}</td>
                    {showAuthor && <td>{t.author.displayName}</td>}
                    <td>{t.assignee?.displayName ?? <span className="muted">—</span>}</td>
                    <td>{fmtDate(t.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={list.data.page} totalPages={list.data.totalPages} onChange={setPage} />
        </>
      )}
    </div>
  );
}
