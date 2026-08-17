import { Megaphone } from "lucide-react";
import PagePlaceholder from "@/components/PagePlaceholder";

export default function CampaignsPage() {
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
