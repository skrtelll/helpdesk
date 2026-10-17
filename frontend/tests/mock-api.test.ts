// Сценарные проверки бизнес-правил mock-API (то же поведение ожидается от настоящего backend).
// Запуск: npm run test:mock
import assert from "node:assert/strict";

const store = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
};

async function main() {
  const { mockApi: api } = await import("../lib/api/mock");
  const { ApiError } = await import("../lib/api/types");

  const as = async (email: string) => api.login(email, "password123");
  const fails = async (code: string, fn: () => Promise<unknown>, label: string) => {
    try {
      await fn();
    } catch (e) {
      assert.ok(e instanceof ApiError, `${label}: ожидался ApiError`);
      assert.equal(e.code, code, `${label}: код ${e.code} вместо ${code}`);
      console.log("ok  -", label);
      return;
    }
    assert.fail(`${label}: ожидалась ошибка ${code}`);
  };
  const ok = (label: string) => console.log("ok  -", label);

  // --- USER создаёт заявку (BR-003)
  await as("user@helpdesk.test");
  await fails("VALIDATION_FAILED", () => api.createTicket({ title: "  ", description: "x" }), "пустая тема отклоняется");
  const t = await api.createTicket({ title: "Сломался принтер", description: "Не печатает" });
  assert.equal(t.status, "NEW");
  assert.equal(t.priority, "MEDIUM");
  assert.equal(t.category.code, "OTHER");
  assert.equal(t.assignee, null);
  ok("новая заявка: NEW / MEDIUM / OTHER / без исполнителя");

  await fails("FORBIDDEN", () => api.supportQueue({}), "USER не видит очередь поддержки");
  await fails("FORBIDDEN", () => api.addComment(t.id, "x", true), "USER не может писать внутренние комментарии");
  await fails("FORBIDDEN", () => api.takeTicket(t.id, 0), "USER не может взять заявку");

  // --- SUPPORT берёт заявку; гонка (BR-005)
  await as("support@helpdesk.test");
  const taken = await api.takeTicket(t.id, t.version);
  assert.equal(taken.status, "IN_PROGRESS");
  assert.equal(taken.assignee?.displayName, "Сергей Поддержкин");
  ok("take: NEW → IN_PROGRESS, исполнитель назначен");
  await as("admin@helpdesk.test");
  await fails("ALREADY_ASSIGNED", () => api.takeTicket(t.id, t.version), "второй take → ALREADY_ASSIGNED");

  // --- optimistic locking (BR-012)
  await as("support@helpdesk.test");
  await fails("VERSION_CONFLICT", () => api.updateTicket(t.id, { priority: "HIGH" }, 0), "устаревшая версия → VERSION_CONFLICT");
  const upd = await api.updateTicket(t.id, { priority: "HIGH" }, taken.version);
  assert.equal(upd.priority, "HIGH");
  ok("смена приоритета с актуальной версией");

  // --- state machine (BR-006) и права
  await fails("INVALID_STATUS_TRANSITION", () => api.changeStatus(t.id, "CLOSED", upd.version), "IN_PROGRESS → CLOSED недопустим");
  const waiting = await api.changeStatus(t.id, "WAITING_FOR_USER", upd.version);
  assert.equal(waiting.status, "WAITING_FOR_USER");

  // --- внутренний комментарий скрыт от USER (BR-007); публичный ответ USER возвращает в работу (BR-013)
  await api.addComment(t.id, "Заметка для коллег", true);
  await api.addComment(t.id, "Уточните модель принтера", false);
  await as("user@helpdesk.test");
  const visible = await api.listComments(t.id);
  assert.deepEqual(visible.map((c) => c.internal), [false]);
  const hist = await api.listHistory(t.id);
  assert.ok(hist.every((h) => !h.internal), "USER не видит внутренние записи истории");
  ok("USER не видит внутренние комментарии и записи истории");
  await api.addComment(t.id, "HP LaserJet 1020", false);
  const afterReply = await api.getTicket(t.id);
  assert.equal(afterReply.status, "IN_PROGRESS");
  ok("публичный комментарий USER: WAITING_FOR_USER → IN_PROGRESS");

  // --- решение, закрытие, неизменяемость (BR-008)
  await as("support@helpdesk.test");
  const resolved = await api.changeStatus(t.id, "RESOLVED", afterReply.version);
  assert.ok(resolved.resolvedAt);
  await fails("FORBIDDEN", () => api.changeStatus(t.id, "CLOSED", resolved.version), "SUPPORT не может закрыть заявку");
  await as("user@helpdesk.test");
  const closed = await api.changeStatus(t.id, "CLOSED", resolved.version);
  assert.equal(closed.status, "CLOSED");
  assert.ok(closed.closedAt);
  await fails("TICKET_TERMINAL", () => api.addComment(t.id, "ещё", false), "CLOSED: комментарии запрещены");
  await as("support@helpdesk.test");
  await fails("TICKET_TERMINAL", () => api.updateTicket(t.id, { priority: "LOW" }, closed.version), "CLOSED: изменения запрещены");
  const log = (await api.listHistory(t.id)).map((h) => h.type);
  assert.ok(log.includes("TICKET_CREATED") && log.includes("TICKET_RESOLVED") && log.includes("TICKET_CLOSED"));
  ok("история фиксирует создание, решение и закрытие");

  // --- отмена: только NEW без исполнителя
  await as("user@helpdesk.test");
  const t2 = await api.createTicket({ title: "Ошибочная", description: "случайно" });
  const cancelled = await api.changeStatus(t2.id, "CANCELLED", t2.version);
  assert.equal(cancelled.status, "CANCELLED");
  ok("USER отменяет свою новую заявку");

  // --- ownership: чужая заявка = 404
  await api.register("other@helpdesk.test", "password123", "Другой");
  await as("other@helpdesk.test");
  await fails("NOT_FOUND", () => api.getTicket(t.id), "чужая заявка → 404");
  await fails("EMAIL_ALREADY_EXISTS", () => api.register("OTHER@helpdesk.test", "password123", "Дубль"), "email уникален без учёта регистра");
  await fails("VALIDATION_FAILED", () => api.register("short@helpdesk.test", "1234567", "Short"), "пароль короче 8 символов отклоняется");

  // --- ADMIN: назначение, категории, LAST_ADMIN
  await as("admin@helpdesk.test");
  const t3 = await api.createTicket({ title: "Для назначения", description: "тест" });
  const support = (await api.listUsers({ size: 100 })).items.find((u) => u.role === "SUPPORT")!;
  const assigned = await api.assignTicket(t3.id, support.id, t3.version);
  assert.equal(assigned.status, "IN_PROGRESS");
  ok("ADMIN назначает исполнителя: NEW → IN_PROGRESS");
  const user = (await api.listUsers({ size: 100 })).items.find((u) => u.role === "USER")!;
  await fails("INVALID_ASSIGNEE", () => api.assignTicket(t3.id, user.id, assigned.version), "USER нельзя назначить исполнителем");
  const admin = (await api.me());
  await fails("LAST_ADMIN", () => api.updateUser(admin.id, { enabled: false }), "последнего ADMIN отключить нельзя");
  await fails("LAST_ADMIN", () => api.updateUser(admin.id, { role: "SUPPORT" }), "последнего ADMIN понизить нельзя");
  await fails("CATEGORY_CODE_EXISTS", () => api.createCategory({ code: "OTHER", name: "Дубль" }), "код категории уникален");
  const cat = await api.createCategory({ code: "BILLING", name: "Биллинг" });
  await api.updateCategory(cat.id, { active: false });
  await fails("CATEGORY_INACTIVE", () => api.updateTicket(t3.id, { categoryId: cat.id }, assigned.version), "неактивную категорию выбрать нельзя");

  // --- очередь: приоритет по убыванию, затем старые
  const queue = await api.supportQueue({ size: 100 });
  const rank = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 } as const;
  for (let i = 1; i < queue.items.length; i++) {
    assert.ok(rank[queue.items[i - 1].priority] >= rank[queue.items[i].priority], "очередь отсортирована по приоритету");
  }
  ok("очередь отсортирована по приоритету");
  console.log("\nВСЕ СЦЕНАРИИ MOCK-API ПРОЙДЕНЫ");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
