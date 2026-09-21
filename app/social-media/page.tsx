import { redirect } from "next/navigation";
import { Camera } from "lucide-react";
import PagePlaceholder from "@/components/PagePlaceholder";
import SocialDashboard from "@/components/social/SocialDashboard";
import { getCurrentUser } from "@/lib/auth/currentUser";

export default async function SocialMediaPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");

  return (
    <PagePlaceholder icon={Camera} title="Social Media" subtitle={me.role === "client" ? `Instagram performance for ${me.clientName ?? "your brand"}` : "Organic Instagram performance per client, stored daily so history builds up over time"}>
      <SocialDashboard canManage={me.role !== "client"} />
    </PagePlaceholder>
  );
}
