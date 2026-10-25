import type { FormInstance } from "antd";
import { ApiError } from "@/shared/api";

/** Ошибки полей из ответа backend (422) → подсветка под соответствующими полями формы. */
export function applyFieldErrors(form: FormInstance, e: unknown): void {
  if (e instanceof ApiError && e.fieldErrors) {
    form.setFields(Object.entries(e.fieldErrors).map(([name, message]) => ({ name, errors: [message] })));
  }
}
