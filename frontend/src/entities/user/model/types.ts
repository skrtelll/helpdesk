import { ROUTES } from "@/shared/config";

export type UserRole = "USER" | "SUPPORT" | "ADMIN";

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export const ROLE_LABEL: Record<UserRole, string> = {
  USER: "Пользователь",
  SUPPORT: "Поддержка",
  ADMIN: "Администратор",
};

/** Сотрудник поддержки или администратор. Только для UX: права проверяет backend. */
export function isStaff(role: UserRole): boolean {
  return role === "SUPPORT" || role === "ADMIN";
}

/** Куда вести пользователя после входа. */
export function homePath(role: UserRole): string {
  return isStaff(role) ? ROUTES.queue : ROUTES.tickets;
}
