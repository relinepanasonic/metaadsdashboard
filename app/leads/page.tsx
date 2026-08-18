import { Users } from "lucide-react";
import { redirect } from "next/navigation";
import PagePlaceholder from "@/components/PagePlaceholder";
import { getCurrentUser } from "@/lib/auth/currentUser";

export default async function LeadsPage() {
  const me = await getCurrentUser();
  if (me?.role === "client") redirect("/");

  return (
    <PagePlaceholder
      icon={Users}
      title="Leads"
      subtitle="WhatsApp leads captured from Meta Ads"
      status="Coming Soon"
    >
      <div className="glass-panel p-6 text-sm text-slate-400">
        This page will pull WhatsApp leads from Supabase — synced from your Meta lead-gen campaigns —
        with status tracking (new / contacted / qualified / closed).
      </div>
    </PagePlaceholder>
  );
}
