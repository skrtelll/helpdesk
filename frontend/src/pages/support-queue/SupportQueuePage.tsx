"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert, Checkbox, Select, Table, Typography, type TableColumnsType } from "antd";
import { Protected } from "@/features/auth";
import { TakeButton } from "@/features/ticket-take";
import { listCategories } from "@/entities/category";
import { PRIORITIES, PRIORITY_LABEL, TicketPriorityTag, TicketStatusTag, formatDate, listQueue, type TicketPriority, type TicketSummary } from "@/entities/ticket";
import { ROUTES } from "@/shared/config";
import { useAsync } from "@/shared/lib";
import { EmptyState, ErrorState, LoadingState, PageContainer } from "@/shared/ui";

const PAGE_SIZE = 10;

// Пустое значение — порядок очереди по умолчанию на backend: приоритет по убыванию, затем старые первыми.
const SORT_OPTIONS = [
  { value: "", label: "По приоритету (по умолчанию)" },
  { value: "createdAt,asc", label: "Сначала старые" },
  { value: "createdAt,desc", label: "Сначала новые" },
  { value: "updatedAt,desc", label: "Недавно обновлённые" },
];

function QueueContent() {
  const [page, setPage] = useState(0);
  const [priority, setPriority] = useState<TicketPriority | "">("");
  const [category, setCategory] = useState("");
  const [unassigned, setUnassigned] = useState(false);
  const [sort, setSort] = useState("");
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const categories = useAsync(listCategories, []);
  const { data, error, loading, reload } = useAsync(
    () => listQueue({ page, size: PAGE_SIZE, priority: priority || undefined, category: category || undefined, unassigned: unassigned || undefined, sort: sort || undefined }),
    [page, priority, category, unassigned, sort],
  );

  // При смене фильтра или сортировки возвращаемся на первую страницу
  const withReset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(0);
  };

  const columns: TableColumnsType<TicketSummary> = [
    { title: "№", dataIndex: "number", render: (number: string, t: TicketSummary) => <Link href={ROUTES.ticket(t.id)}>{number}</Link> },
    { title: "Тема", dataIndex: "title" },
    { title: "Приоритет", dataIndex: "priority", render: (p: TicketSummary["priority"]) => <TicketPriorityTag priority={p} /> },
    { title: "Категория", dataIndex: "category", render: (c: TicketSummary["category"]) => c.name },
    { title: "Статус", dataIndex: "status", render: (s: TicketSummary["status"]) => <TicketStatusTag status={s} /> },
    { title: "Исполнитель", dataIndex: "assignee", render: (a: TicketSummary["assignee"]) => a?.displayName ?? "—" },
    { title: "Создана", dataIndex: "createdAt", render: (d: string) => formatDate(d) },
    {
      title: "",
      key: "take",
      render: (_: unknown, t: TicketSummary) => (
        <TakeButton
          ticket={t}
          onTaken={() => {
            setNotice({ type: "success", text: `Заявка ${t.number} взята в работу` });
            reload();
          }}
          onError={(text) => {
            setNotice({ type: "error", text });
            reload();
          }}
        />
      ),
    },
  ];

  let content;
  if (loading && !data) content = <LoadingState />;
  else if (error) content = <ErrorState error={error} onRetry={reload} />;
  else if (!data || data.totalElements === 0) content = <EmptyState description="Заявок по выбранным условиям нет" />;
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
      <Typography.Title level={3}>Очередь поддержки</Typography.Title>
      {notice && <Alert type={notice.type} showIcon closable message={notice.text} onClose={() => setNotice(null)} style={{ marginBottom: 16 }} />}
      {categories.error !== undefined && (
        <Alert type="warning" showIcon message="Не удалось загрузить категории, фильтр по категории недоступен" style={{ marginBottom: 16 }} />
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 16 }}>
        <Select<string> value={category} onChange={withReset(setCategory)} style={{ width: 190 }} loading={categories.loading} options={[{ value: "", label: "Все категории" }, ...(categories.data ?? []).map((c) => ({ value: c.code, label: c.name }))]} />
        <Select<TicketPriority | ""> value={priority} onChange={withReset(setPriority)} style={{ width: 170 }} options={[{ value: "", label: "Все приоритеты" }, ...PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))]} />
        <Checkbox checked={unassigned} onChange={(e) => withReset(setUnassigned)(e.target.checked)}>Только без исполнителя</Checkbox>
        <Select<string> value={sort} onChange={withReset(setSort)} style={{ width: 240 }} options={SORT_OPTIONS} />
      </div>
      {content}
    </PageContainer>
  );
}

export function SupportQueuePage() {
  return (
    <Protected roles={["SUPPORT", "ADMIN"]}>
      <QueueContent />
    </Protected>
  );
}
