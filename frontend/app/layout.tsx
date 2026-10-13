import type { ReactNode } from "react";

export const metadata = {
  title: "HelpDesk",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
