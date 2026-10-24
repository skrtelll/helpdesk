"use client";

import type { ReactNode } from "react";
import { Button, Empty, Result, Spin } from "antd";
import { errorText } from "@/shared/api";

export function LoadingState() {
  return (
    <div role="status" style={{ textAlign: "center", padding: 48 }}>
      <Spin size="large" />
      <p style={{ marginTop: 12, color: "#667085" }}>Загрузка…</p>
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <Result
      status="error"
      title="Не удалось загрузить данные"
      subTitle={errorText(error)}
      extra={onRetry ? <Button type="primary" onClick={onRetry}>Повторить</Button> : undefined}
    />
  );
}

export function EmptyState({ description, action }: { description: string; action?: ReactNode }) {
  return <Empty description={description} style={{ padding: 32 }}>{action}</Empty>;
}
