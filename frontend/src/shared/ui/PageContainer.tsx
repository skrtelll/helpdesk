import type { CSSProperties, ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** narrow — формы, wide — списки */
  width?: "narrow" | "wide";
}

const WIDTH = { narrow: 480, wide: 1100 } as const;

export function PageContainer({ children, width = "narrow" }: Props) {
  const style: CSSProperties = { maxWidth: WIDTH[width], margin: "24px auto", padding: "0 8px" };
  return <main style={style}>{children}</main>;
}
