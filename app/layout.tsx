import type { Metadata } from "next";
import type { ReactNode } from "react";
export const metadata: Metadata = {
  title: "Decode Infra | Hyderabad Real Estate Intelligence",
  description: "Hyderabad real estate, infrastructure, RERA and city development news from the past 30 days.",
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body style={{ margin: 0, background: "#f6f7f2" }}>{children}</body></html>;
}
