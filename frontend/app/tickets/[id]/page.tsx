import { TicketDetailPage } from "@/pages/ticket-detail";

export default function Page({ params }: { params: { id: string } }) {
  return <TicketDetailPage id={params.id} />;
}
