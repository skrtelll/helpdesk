"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Form, Input } from "antd";
import { createTicket } from "@/entities/ticket";
import { errorText } from "@/shared/api";
import { ROUTES } from "@/shared/config";
import { applyFieldErrors } from "@/shared/lib";

interface Values {
  title: string;
  description: string;
}

export function CreateTicketForm() {
  const router = useRouter();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFinish(values: Values) {
    setError(null);
    setSubmitting(true);
    try {
      const ticket = await createTicket({ title: values.title.trim(), description: values.description.trim() });
      router.push(ROUTES.ticket(ticket.id));
    } catch (e) {
      applyFieldErrors(form, e);
      setError(errorText(e));
      setSubmitting(false);
    }
  }

  return (
    <>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
      <Form<Values> form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
        <Form.Item name="title" label="Тема" rules={[{ required: true, whitespace: true, message: "Введите тему" }, { max: 200, message: "Не длиннее 200 символов" }]}>
          <Input showCount maxLength={200} />
        </Form.Item>
        <Form.Item name="description" label="Описание" rules={[{ required: true, whitespace: true, message: "Опишите проблему" }]}>
          <Input.TextArea rows={6} />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={submitting}>Создать заявку</Button>
      </Form>
    </>
  );
}
