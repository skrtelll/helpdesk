"use client";

import { Tag } from "antd";
import { PRIORITY_LABEL, STATUS_LABEL, type TicketPriority, type TicketStatus } from "../model/types";

const STATUS_COLOR: Record<TicketStatus, string> = {
  NEW: "blue",
  IN_PROGRESS: "orange",
  WAITING_FOR_USER: "purple",
  RESOLVED: "green",
  CLOSED: "default",
  CANCELLED: "default",
};

const PRIORITY_COLOR: Record<TicketPriority, string> = {
  LOW: "default",
  MEDIUM: "blue",
  HIGH: "orange",
  CRITICAL: "red",
};

export function TicketStatusTag({ status }: { status: TicketStatus }) {
  return <Tag color={STATUS_COLOR[status]}>{STATUS_LABEL[status]}</Tag>;
}

export function TicketPriorityTag({ priority }: { priority: TicketPriority }) {
  return <Tag color={PRIORITY_COLOR[priority]}>{PRIORITY_LABEL[priority]}</Tag>;
}
