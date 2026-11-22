"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Table, Typography, type TableColumnsType } from "antd";
import { Protected } from "@/features/auth";
import { PRIORITY_LABEL, TicketStatusTag, formatDate, listTickets, type TicketSummary } from "@/entities/ticket";
import { isStaff, useSession } from "@/entities/user";
import { ROUTES } from "@/shared/config";
import { useAsync } from "@/shared/lib";
import { EmptyState, ErrorState, LoadingState, PageContainer } from "@/shared/ui";

const PAGE_SIZE = 10;

const columns: TableColumnsType<TicketSummary> = [
  { title: "№", dataIndex: "number", render: (number: string, t: TicketSummary) => <Link href={ROUTES.ticket(t.id)}>{number}</Link> },
  { title: "Тема", dataIndex: "title" },
  { title: "Статус", dataIndex: "status", render: (status: TicketSummary["status"]) => <TicketStatusTag status={status} /> },
  { title: "Категория", dataIndex: "category", render: (c: TicketSummary["category"]) => c.name },
  { title: "Приоритет", dataIndex: "priority", render: (p: TicketSummary["priority"]) => PRIORITY_LABEL[p] },
  { title: "Исполнитель", dataIndex: "assignee", render: (a: TicketSummary["assignee"]) => a?.displayName ?? "—" },
  { title: "Создана", dataIndex: "createdAt", render: (d: string) => formatDate(d) },
];

function TicketListContent() {
  const { user } = useSession();
  const [page, setPage] = useState(0);
  const { data, error, loading, reload } = useAsync(() => listTickets({ page, size: PAGE_SIZE, sort: "createdAt,desc" }), [page]);

  const createButton = (
    <Link href={ROUTES.ticketNew}>
      <Button type="primary">Создать заявку</Button>
    </Link>
  );

  let content;
  if (loading && !data) content = <LoadingState />;
  else if (error) content = <ErrorState error={error} onRetry={reload} />;
  else if (!data || data.totalElements === 0) content = <EmptyState description="Заявок пока нет" action={createButton} />;
  else {
    content = (
      <Table<TicketSummary>
        rowKey="id"
        columns={columns}
        dataSource={data.content}
        loading={loading}
        scroll={{ x: true }}
        pagination={{ current: data.page + 1, pageSize: PAGE_SIZE, total: data.totalElements, showSizeChanger: false, hideOnSinglePage: true, onChange: (p: number) => setPage(p - 1) }}
      />
    );
  }

  return (
    <PageContainer width="wide">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>{user && isStaff(user.role) ? "Все заявки" : "Мои заявки"}</Typography.Title>
        {createButton}
      </div>
      {content}
    </PageContainer>
  );
}

export function TicketListPage() {
  return (
    <Protected>
      <TicketListContent />
    </Protected>
  );
}
