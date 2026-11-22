import { apiRequest } from "@/shared/api";
import { getTicket } from "@/entities/ticket";

/**
 * POST /tickets/{id}/take (SUPPORT/ADMIN, документация п. 7.3, 12): атомарно берёт свободную заявку.
 * Тело — { version }. В списках заявок поля version нет, поэтому актуальная версия читается перед вызовом.
 * Ожидаемые ошибки: 409 ALREADY_ASSIGNED, 409 INVALID_STATUS_TRANSITION, 409 VERSION_CONFLICT.
 */
export async function takeTicket(id: string): Promise<void> {
  const { version } = await getTicket(id);
  await apiRequest<unknown>("POST", `/tickets/${encodeURIComponent(id)}/take`, { body: { version } });
}
