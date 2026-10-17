// Жизненный цикл заявки (ТЗ, раздел 5). Единственный источник правды для UI и mock-API.
// NEW -> IN_PROGRESS выполняется операцией take/assign, а не сменой статуса.
import type { Role, Status } from "./types";

type Who = "staff" | "authorOrAdmin";

export const TRANSITIONS: { from: Status; to: Status; who: Who }[] = [
  { from: "NEW", to: "CANCELLED", who: "authorOrAdmin" },
  { from: "IN_PROGRESS", to: "WAITING_FOR_USER", who: "staff" },
  { from: "WAITING_FOR_USER", to: "IN_PROGRESS", who: "staff" },
  { from: "IN_PROGRESS", to: "RESOLVED", who: "staff" },
  { from: "RESOLVED", to: "IN_PROGRESS", who: "staff" },
  { from: "RESOLVED", to: "CLOSED", who: "authorOrAdmin" },
];

export function transitionExists(from: Status, to: Status): boolean {
  return TRANSITIONS.some((t) => t.from === from && t.to === to);
}

export function isAllowed(actor: { id: string; role: Role }, authorId: string, from: Status, to: Status): boolean {
  const t = TRANSITIONS.find((x) => x.from === from && x.to === to);
  if (!t) return false;
  if (t.who === "staff") return actor.role !== "USER";
  return actor.role === "ADMIN" || (actor.role === "USER" && actor.id === authorId);
}

export function nextStatuses(actor: { id: string; role: Role }, authorId: string, from: Status): Status[] {
  return TRANSITIONS.filter((t) => t.from === from && isAllowed(actor, authorId, t.from, t.to)).map((t) => t.to);
}
