"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Button, Form, Input } from "antd";
import { errorText, saveTokens } from "@/shared/api";
import { ROUTES } from "@/shared/config";
import { applyFieldErrors } from "@/shared/lib";
import { login } from "../api/authApi";

interface Values {
  email: string;
  password: string;
}

export function LoginForm() {
  const router = useRouter();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFinish(values: Values) {
    setError(null);
    setSubmitting(true);
    try {
      saveTokens(await login(values.email.trim(), values.password));
      router.push(ROUTES.tickets);
    } catch (e) {
      applyFieldErrors(form, e);
      setError(errorText(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
      <Form<Values> form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
        <Form.Item name="email" label="Email" rules={[{ required: true, message: "Введите email" }, { type: "email", message: "Некорректный email" }]}>
          <Input autoComplete="username" />
        </Form.Item>
        <Form.Item name="password" label="Пароль" rules={[{ required: true, message: "Введите пароль" }]}>
          <Input.Password autoComplete="current-password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={submitting} block>Войти</Button>
      </Form>
      <p style={{ marginTop: 16, marginBottom: 0 }}>
        Нет аккаунта? <Link href={ROUTES.register}>Зарегистрироваться</Link>
      </p>
    </>
  );
}
