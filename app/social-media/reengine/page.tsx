import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/currentUser";
import ReEngine from "@/components/social/ReEngine";

// Staff only: it spends AI credits and holds the series' prompt rules.
export default async function ReEnginePage() {
  const me = await getCurrentUser();
  if (!me || me.role === "client") redirect("/social-media");
  return <ReEngine />;
}
