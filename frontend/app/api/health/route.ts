// Healthcheck для Docker Compose и деплоя
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "UP" });
}
