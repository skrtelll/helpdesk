"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Alert, Card, Descriptions, Typography } from "antd";
import { Protected } from "@/features/auth";
import { TakeButton } from "@/features/ticket-take";
import { TicketPriorityTag, TicketStatusTag, formatDate, getTicket } from "@/entities/ticket";
import { ApiError } from "@/shared/api";
import { ROUTES } from "@/shared/config";
import { useAsync } from "@/shared/lib";
import { EmptyState, ErrorState, LoadingState, PageContainer } from "@/shared/ui";

function TicketDetailContent({ id }: { id: string }) {
  const { data, error, loading, reload } = useAsync(() => getTicket(id), [id]);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  let content;
  if (loading && !data) content = <LoadingState />;
  else if (error instanceof ApiError && error.status === 404) content = <EmptyState description="Заявка не найдена" />;
  else if (error) content = <ErrorState error={error} onRetry={reload} />;
  else if (!data) content = <EmptyState description="Заявка не найдена" />;
  else {
    content = (
      <Card
        title={`${data.number} · ${data.title}`}
        extra={
          <TakeButton
            ticket={data}
            onTaken={() => {
              setNotice({ type: "success", text: "Заявка взята в работу" });
              reload();
            }}
            onError={(text) => {
              setNotice({ type: "error", text });
              reload();
            }}
          />
        }
      >
        {notice && <Alert type={notice.type} showIcon closable message={notice.text} onClose={() => setNotice(null)} style={{ marginBottom: 16 }} />}
        <Descriptions
          column={1}
          items={[
            { key: "status", label: "Статус", children: <TicketStatusTag status={data.status} /> },
            { key: "priority", label: "Приоритет", children: <TicketPriorityTag priority={data.priority} /> },
            { key: "category", label: "Категория", children: data.category.name },
            { key: "assignee", label: "Исполнитель", children: data.assignee?.displayName ?? "не назначен" },
            { key: "created", label: "Создана", children: formatDate(data.createdAt) },
            { key: "updated", label: "Обновлена", children: formatDate(data.updatedAt) },
          ]}
        />
        <Typography.Title level={5}>Описание</Typography.Title>
        <Typography.Paragraph style={{ whiteSpace: "pre-wrap" }}>{data.description}</Typography.Paragraph>
      </Card>
    );
  }

  return (
    <PageContainer>
      <p><Link href={ROUTES.tickets}>← К списку заявок</Link></p>
      {content}
    </PageContainer>
  );
}

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <Protected>
      <TicketDetailContent id={id} />
    </Protected>
  );
}
