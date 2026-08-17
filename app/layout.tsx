import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Unified Ads Command Center · Prof Toko Online",
  description: "Meta Ads + Google Ads unified analytics dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="antialiased">{children}</body>
    </html>
  );
}
