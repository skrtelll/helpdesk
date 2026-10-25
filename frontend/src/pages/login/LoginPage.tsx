"use client";

import { Card, Typography } from "antd";
import { LoginForm } from "@/features/auth";
import { PageContainer } from "@/shared/ui";

export function LoginPage() {
  return (
    <PageContainer>
      <Card>
        <Typography.Title level={3}>Вход</Typography.Title>
        <LoginForm />
      </Card>
    </PageContainer>
  );
}
