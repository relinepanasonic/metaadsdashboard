import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prof Meta Ads Dashboard",
  description: "Meta Ads performance dashboard for Profesor Toko Online",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="bg-gray-950 text-white antialiased">{children}</body>
    </html>
  );
}
