"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Button, Form, Input } from "antd";
import { errorText } from "@/shared/api";
import { ROUTES } from "@/shared/config";
import { applyFieldErrors } from "@/shared/lib";
import { register } from "../api/authApi";

interface Values {
  displayName: string;
  email: string;
  password: string;
}

export function RegisterForm() {
  const router = useRouter();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFinish(values: Values) {
    setError(null);
    setSubmitting(true);
    try {
      await register(values.email.trim(), values.password, values.displayName.trim());
      router.push(ROUTES.login);
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
        <Form.Item name="displayName" label="Имя" rules={[{ required: true, whitespace: true, message: "Введите имя" }, { max: 100, message: "Не длиннее 100 символов" }]}>
          <Input />
        </Form.Item>
        <Form.Item name="email" label="Email" rules={[{ required: true, message: "Введите email" }, { type: "email", message: "Некорректный email" }]}>
          <Input autoComplete="username" />
        </Form.Item>
        <Form.Item name="password" label="Пароль" rules={[{ required: true, message: "Введите пароль" }, { min: 8, message: "Минимум 8 символов" }]}>
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={submitting} block>Зарегистрироваться</Button>
      </Form>
      <p style={{ marginTop: 16, marginBottom: 0 }}>
        Уже есть аккаунт? <Link href={ROUTES.login}>Войти</Link>
      </p>
    </>
  );
}
