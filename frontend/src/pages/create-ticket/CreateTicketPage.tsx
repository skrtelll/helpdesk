"use client";

import Link from "next/link";
import { Card, Typography } from "antd";
import { CreateTicketForm } from "@/features/ticket-create";
import { ROUTES } from "@/shared/config";
import { PageContainer } from "@/shared/ui";

export function CreateTicketPage() {
  return (
    <PageContainer>
      <p><Link href={ROUTES.tickets}>← К списку заявок</Link></p>
      <Card>
        <Typography.Title level={3}>Новая заявка</Typography.Title>
        <CreateTicketForm />
      </Card>
    </PageContainer>
  );
}
