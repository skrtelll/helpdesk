"use client";

import Link from "next/link";
import { Card, Descriptions, Typography } from "antd";
import { TicketPriorityTag, TicketStatusTag, formatDate, getTicket } from "@/entities/ticket";
import { ApiError } from "@/shared/api";
import { ROUTES } from "@/shared/config";
import { useAsync } from "@/shared/lib";
import { EmptyState, ErrorState, LoadingState, PageContainer } from "@/shared/ui";

export function TicketDetailPage({ id }: { id: string }) {
  const { data, error, loading, reload } = useAsync(() => getTicket(id), [id]);

  let content;
  if (loading && !data) content = <LoadingState />;
  else if (error instanceof ApiError && error.status === 404) content = <EmptyState description="Заявка не найдена" />;
  else if (error) content = <ErrorState error={error} onRetry={reload} />;
  else if (!data) content = <EmptyState description="Заявка не найдена" />;
  else {
    content = (
      <Card title={`${data.number} · ${data.title}`}>
        <Descriptions
          column={1}
          items={[
            { key: "status", label: "Статус", children: <TicketStatusTag status={data.status} /> },
            { key: "priority", label: "Приоритет", children: <TicketPriorityTag priority={data.priority} /> },
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
