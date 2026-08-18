import { Megaphone } from "lucide-react";
import { redirect } from "next/navigation";
import PagePlaceholder from "@/components/PagePlaceholder";
import { getCurrentUser } from "@/lib/auth/currentUser";

export default async function CampaignsPage() {
  const me = await getCurrentUser();
  if (me?.role === "client") redirect("/");

  return (
    <PagePlaceholder
      icon={Megaphone}
      title="Campaigns"
      subtitle="All campaigns across Meta + Google"
      status="Coming Soon"
    >
      <div className="glass-panel p-6 text-sm text-slate-400">
        A unified, sortable campaign table (spend, ROAS, conversions, status) will live here.
      </div>
    </PagePlaceholder>
  );
}
