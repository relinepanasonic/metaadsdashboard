"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";

const NO_SIDEBAR_PREFIXES = ["/login", "/forgot-password", "/reset-password", "/setup", "/invite/"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare = NO_SIDEBAR_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));

  if (bare) return <>{children}</>;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
