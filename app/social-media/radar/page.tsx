import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/currentUser";
import RadarBoard from "@/components/social/RadarBoard";

// Staff only: it reads other accounts' public data and spends AI credits.
export default async function RadarPage() {
  const me = await getCurrentUser();
  if (!me || me.role === "client") redirect("/social-media");
  return <RadarBoard />;
}
