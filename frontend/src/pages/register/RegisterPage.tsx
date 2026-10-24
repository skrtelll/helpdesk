"use client";

import { Card, Typography } from "antd";
import { RegisterForm } from "@/features/auth";
import { PageContainer } from "@/shared/ui";

export function RegisterPage() {
  return (
    <PageContainer>
      <Card>
        <Typography.Title level={3}>Регистрация</Typography.Title>
        <RegisterForm />
      </Card>
    </PageContainer>
  );
}
