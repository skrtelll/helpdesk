"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, Typography } from "antd";
import { LoginForm } from "@/features/auth";
import { homePath, useSession } from "@/entities/user";
import { LoadingState, PageContainer } from "@/shared/ui";

export function LoginPage() {
  const router = useRouter();
  const { user, loading } = useSession();

  // Уже вошедшего пользователя на форму входа не пускаем
  useEffect(() => {
    if (user) router.replace(homePath(user.role));
  }, [user, router]);

  if (loading || user) return <PageContainer><LoadingState /></PageContainer>;

  return (
    <PageContainer>
      <Card>
        <Typography.Title level={3}>Вход</Typography.Title>
        <LoginForm />
      </Card>
    </PageContainer>
  );
}
