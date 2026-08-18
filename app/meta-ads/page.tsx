import { Share2 } from "lucide-react";
import { redirect } from "next/navigation";
import PagePlaceholder from "@/components/PagePlaceholder";
import CampaignsTable from "@/components/CampaignsTable";
import { getCurrentUser } from "@/lib/auth/currentUser";

export default async function MetaAdsPage() {
  const me = await getCurrentUser();
  if (me?.role === "client") redirect("/");

  return (
    <PagePlaceholder
      icon={Share2}
      title="Meta Ads — Campaigns"
      subtitle="Filter by Business, Ad Account, Client, and Date Range"
    >
      <CampaignsTable />
    </PagePlaceholder>
  );
}
