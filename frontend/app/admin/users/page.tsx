"use client";

import { useState } from "react";
import Pagination from "@/components/Pagination";
import Protected from "@/components/Protected";
import { Empty, ErrorBox, Loading } from "@/components/States";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ROLE_LABEL, errorText, fmtDate } from "@/lib/labels";
import type { Role } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";

const ROLES: Role[] = ["USER", "SUPPORT", "ADMIN"];

function Users() {
  const { user: me } = useAuth();
  const [page, setPage] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const list = useAsync(() => api.listUsers({ page, size: 10 }), [page]);

  async function change(id: string, patch: { role?: Role; enabled?: boolean }) {
    setBusyId(id);
    setError(null);
    try {
      await api.updateUser(id, patch);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusyId(null);
      list.reload();
    }
  }

  return (
    <div className="stack">
      <h1>Пользователи</h1>
      {error && <div className="alert error" role="alert">{error}</div>}
      {list.loading && !list.data ? <Loading /> : list.error ? <ErrorBox error={list.error} onRetry={list.reload} /> : !list.data || list.data.items.length === 0 ? (
        <Empty>Пользователей нет.</Empty>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Имя</th><th>Email</th><th>Роль</th><th>Активен</th><th>Создан</th></tr></thead>
              <tbody>
                {list.data.items.map((u) => (
                  <tr key={u.id}>
                    <td>{u.displayName}{u.id === me?.id && <span className="muted"> (вы)</span>}</td>
                    <td>{u.email}</td>
                    <td>
                      <select value={u.role} disabled={busyId === u.id} onChange={(e) => change(u.id, { role: e.target.value as Role })}>
                        {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                      </select>
                    </td>
                    <td><input type="checkbox" checked={u.enabled} disabled={busyId === u.id} onChange={(e) => change(u.id, { enabled: e.target.checked })} aria-label={`Активен: ${u.displayName}`} /></td>
                    <td>{fmtDate(u.createdAt)}</td>
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

export default function AdminUsersPage() {
  return <Protected roles={["ADMIN"]}><Users /></Protected>;
}
