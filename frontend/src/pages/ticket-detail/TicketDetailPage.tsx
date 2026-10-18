"use client";

import { Typography } from "antd";

export function TicketDetailPage({ id }: { id: string }) {
  return <Typography.Title level={3}>Заявка {id}</Typography.Title>;
}
