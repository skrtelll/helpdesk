"use client";

import Protected from "@/components/Protected";
import TicketList from "@/components/TicketList";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

function Tickets() {
  const { user } = useAuth();
  const staff = !!user && user.role !== "USER";
  return (
    <div className="stack">
      <h1>{staff ? "Все заявки" : "Мои заявки"}</h1>
      <TicketList
        fetcher={api.listTickets}
        detailBase={staff ? "/support/tickets" : "/tickets"}
        showAuthor={staff}
        emptyText={staff ? "Заявок нет." : "У вас пока нет заявок. Создайте первую."}
      />
    </div>
  );
}

export default function TicketsPage() {
  return <Protected><Tickets /></Protected>;
}
