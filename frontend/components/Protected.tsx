"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/labels";
import type { Role } from "@/lib/types";
import { Forbidden, Loading } from "./States";

const NAV: { href: string; label: string; roles: Role[] }[] = [
  { href: "/tickets", label: "Мои заявки", roles: ["USER"] },
  { href: "/tickets/new", label: "Новая заявка", roles: ["USER", "SUPPORT", "ADMIN"] },
  { href: "/support/queue", label: "Очередь", roles: ["SUPPORT", "ADMIN"] },
  { href: "/support/my-tickets", label: "В работе у меня", roles: ["SUPPORT", "ADMIN"] },
  { href: "/tickets", label: "Все заявки", roles: ["SUPPORT", "ADMIN"] },
  { href: "/admin/users", label: "Пользователи", roles: ["ADMIN"] },
  { href: "/admin/categories", label: "Категории", roles: ["ADMIN"] },
];

/** Страница только для вошедших (и, при необходимости, для заданных ролей). 401 → /login, 403 → отказ. */
export default function Protected({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) return <main className="container"><Loading /></main>;

  const items = NAV.filter((n) => n.roles.includes(user.role));
  return (
    <>
      <header className="topbar">
        <strong className="brand">HelpDesk</strong>
        <nav>
          {items.map((n) => (
            <Link key={n.href + n.label} href={n.href} className={pathname === n.href ? "active" : undefined}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="who">
          <Link href="/profile">{user.displayName}</Link>
          <span className="muted"> · {ROLE_LABEL[user.role]}</span>
          <button className="btn small" onClick={logout} style={{ marginLeft: 12 }}>Выйти</button>
        </div>
      </header>
      <main className="container">{roles && !roles.includes(user.role) ? <Forbidden /> : children}</main>
    </>
  );
}
