"use client";

import Protected from "@/components/Protected";
import TicketList from "@/components/TicketList";
import { api } from "@/lib/api";

export default function QueuePage() {
  return (
    <Protected roles={["SUPPORT", "ADMIN"]}>
      <div className="stack">
        <h1>Очередь поддержки</h1>
        <p className="muted">Активные заявки: сначала высокий приоритет, затем старые.</p>
        <TicketList fetcher={api.supportQueue} detailBase="/support/tickets" showAuthor unassignedFilter emptyText="Очередь пуста." />
      </div>
    </Protected>
  );
}
