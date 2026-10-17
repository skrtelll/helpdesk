"use client";

import Protected from "@/components/Protected";
import TicketList from "@/components/TicketList";
import { api } from "@/lib/api";

export default function MyTicketsPage() {
  return (
    <Protected roles={["SUPPORT", "ADMIN"]}>
      <div className="stack">
        <h1>Мои заявки в работе</h1>
        <TicketList fetcher={api.myTickets} detailBase="/support/tickets" showAuthor emptyText="За вами нет активных заявок." />
      </div>
    </Protected>
  );
}
