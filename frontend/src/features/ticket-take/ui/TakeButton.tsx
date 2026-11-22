"use client";

import { useState } from "react";
import { Button } from "antd";
import type { TicketSummary } from "@/entities/ticket";
import { useSession } from "@/entities/user";
import { errorText } from "@/shared/api";
import { takeTicket } from "../api/takeApi";
import { canTake } from "../model/canTake";

interface Props {
  ticket: TicketSummary;
  onTaken: () => void;
  onError: (message: string) => void;
}

export function TakeButton({ ticket, onTaken, onError }: Props) {
  const { user } = useSession();
  const [busy, setBusy] = useState(false);

  if (!user || !canTake(user, ticket)) return null;

  async function onClick() {
    setBusy(true);
    try {
      await takeTicket(ticket.id);
      onTaken();
    } catch (e) {
      onError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return <Button type="primary" size="small" loading={busy} onClick={onClick}>Взять</Button>;
}
