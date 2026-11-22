"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button, Menu } from "antd";
import { ROLE_LABEL, isStaff, useSession, type UserRole } from "@/entities/user";
import { ROUTES } from "@/shared/config";
import { ErrorState, ForbiddenState, LoadingState, PageContainer } from "@/shared/ui";
import { logout } from "../api/authApi";

interface NavItem {
  href: string;
  label: string;
  staffOnly?: boolean;
}

// Пункты, недоступные роли, скрываются (UX). Реальные ограничения проверяет backend.
const NAV: NavItem[] = [
  { href: ROUTES.queue, label: "Очередь", staffOnly: true },
  { href: ROUTES.tickets, label: "Заявки" },
  { href: ROUTES.ticketNew, label: "Новая заявка" },
];

/** Страница только для вошедших; roles ограничивает доступ по роли. Рисует шапку с меню и кнопкой «Выйти». */
export function Protected({ roles, children }: { roles?: UserRole[]; children: ReactNode }) {
  const { user, loading, error, setUser, reload } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !error && !user) router.replace(ROUTES.login);
  }, [loading, error, user, router]);

  if (loading) return <PageContainer><LoadingState /></PageContainer>;
  if (error) return <PageContainer><ErrorState error={error} onRetry={reload} /></PageContainer>;
  if (!user) return null;

  async function onLogout() {
    await logout();
    setUser(null);
    router.replace(ROUTES.login);
  }

  const items = NAV.filter((n) => !n.staffOnly || isStaff(user.role)).map((n) => ({
    key: n.href,
    label: <Link href={n.href}>{n.label}</Link>,
  }));

  return (
    <>
      <header style={{ display: "flex", alignItems: "center", gap: 16, padding: "0 16px", background: "#fff", borderBottom: "1px solid #e5e7eb" }}>
        <strong>HelpDesk</strong>
        <Menu mode="horizontal" selectedKeys={[pathname]} items={items} style={{ flex: 1, borderBottom: "none" }} />
        <span>{user.displayName} <span style={{ color: "#667085" }}>· {ROLE_LABEL[user.role]}</span></span>
        <Button size="small" onClick={onLogout}>Выйти</Button>
      </header>
      {roles && !roles.includes(user.role) ? <PageContainer><ForbiddenState /></PageContainer> : children}
    </>
  );
}
