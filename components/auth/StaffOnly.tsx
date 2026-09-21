import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth/currentUser";

// Wraps a page a Client user must not open, even by typing the address.
export default async function StaffOnly({ children, redirectTo }: { children: ReactNode; redirectTo: string }) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (me.role === "client") redirect(redirectTo);
  return <>{children}</>;
}
