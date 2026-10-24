"use client";

import Link from "next/link";
import { Button, Table, Typography, type TableColumnsType } from "antd";
import { PRIORITY_LABEL, TicketStatusTag, formatDate, listTickets, type Ticket } from "@/entities/ticket";
import { ROUTES } from "@/shared/config";
import { useAsync } from "@/shared/lib";
import { EmptyState, ErrorState, LoadingState, PageContainer } from "@/shared/ui";

const columns: TableColumnsType<Ticket> = [
  { title: "№", dataIndex: "number", render: (number: string, t: Ticket) => <Link href={ROUTES.ticket(t.id)}>{number}</Link> },
  { title: "Тема", dataIndex: "title" },
  { title: "Статус", dataIndex: "status", render: (status: Ticket["status"]) => <TicketStatusTag status={status} /> },
  { title: "Приоритет", dataIndex: "priority", render: (p: Ticket["priority"]) => PRIORITY_LABEL[p] },
  { title: "Создана", dataIndex: "createdAt", render: (d: string) => formatDate(d) },
];

export function TicketListPage() {
  const { data, error, loading, reload } = useAsync(listTickets, []);

  const createButton = (
    <Link href={ROUTES.ticketNew}>
      <Button type="primary">Создать заявку</Button>
    </Link>
  );

  let content;
  if (loading && !data) content = <LoadingState />;
  else if (error) content = <ErrorState error={error} onRetry={reload} />;
  else if (!data || data.length === 0) content = <EmptyState description="Заявок пока нет" action={createButton} />;
  else content = <Table<Ticket> rowKey="id" columns={columns} dataSource={data} pagination={{ pageSize: 10, hideOnSinglePage: true }} scroll={{ x: true }} />;

  return (
    <PageContainer width="wide">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>Мои заявки</Typography.Title>
        {createButton}
      </div>
      {content}
    </PageContainer>
  );
}
