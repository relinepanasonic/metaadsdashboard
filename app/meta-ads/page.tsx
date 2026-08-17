import { Share2 } from "lucide-react";
import PagePlaceholder from "@/components/PagePlaceholder";
import CampaignsTable from "@/components/CampaignsTable";

export default function MetaAdsPage() {
  return (
    <PagePlaceholder
      icon={Share2}
      title="Meta Ads — Campaigns"
      subtitle="Filter by Business, Ad Account, and Client · Last 30 days"
    >
      <CampaignsTable />
    </PagePlaceholder>
  );
}
