"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import Protected from "@/components/Protected";
import TicketView from "@/components/TicketView";

export default function TicketPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <Protected>
      <p><Link href="/tickets">← К списку</Link></p>
      <TicketView id={id} />
    </Protected>
  );
}
