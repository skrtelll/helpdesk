"use client";

import type { ReactNode } from "react";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ConfigProvider } from "antd";
import ruRU from "antd/locale/ru_RU";
import { SessionProvider } from "@/entities/user";
import { theme } from "./theme";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AntdRegistry>
      <ConfigProvider theme={theme} locale={ruRU}>
        <SessionProvider>{children}</SessionProvider>
      </ConfigProvider>
    </AntdRegistry>
  );
}
