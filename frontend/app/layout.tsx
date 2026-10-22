import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppProviders } from "../src/app/providers";
import "../src/app/styles/globals.css";

export const metadata: Metadata = { title: "HelpDesk" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
