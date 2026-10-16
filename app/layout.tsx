import type { Metadata } from "next";
import type { ReactNode } from "react";
export const metadata: Metadata = {
  title: "Decode Infra | Indian Real Estate Intelligence",
  description: "Live Indian real estate, infrastructure, RERA and city development news.",
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body style={{ margin: 0, background: "#f6f7f2" }}>{children}</body></html>;
}
