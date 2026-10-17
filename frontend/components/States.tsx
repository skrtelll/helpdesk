import type { ReactNode } from "react";
import { errorText } from "@/lib/labels";

export function Loading() {
  return <p className="muted" role="status">Загрузка…</p>;
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="alert error" role="alert">
      {errorText(error)}
      {onRetry && (
        <button className="btn small" onClick={onRetry} style={{ marginLeft: 12 }}>
          Повторить
        </button>
      )}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

export function Forbidden() {
  return (
    <div className="card">
      <h1>Доступ запрещён</h1>
      <p className="muted">У вашей роли нет доступа к этой странице.</p>
    </div>
  );
}
