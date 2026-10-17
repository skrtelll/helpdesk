import { PRIORITY_LABEL, STATUS_LABEL } from "@/lib/labels";
import type { Priority, Status } from "@/lib/types";

export function StatusBadge({ status }: { status: Status }) {
  return <span className={`badge st-${status}`}>{STATUS_LABEL[status]}</span>;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className={`badge pr-${priority}`}>{PRIORITY_LABEL[priority]}</span>;
}
