"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import Protected from "@/components/Protected";
import TicketView from "@/components/TicketView";

export default function SupportTicketPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <Protected roles={["SUPPORT", "ADMIN"]}>
      <p><Link href="/support/queue">← К очереди</Link></p>
      <TicketView id={id} />
    </Protected>
  );
}
