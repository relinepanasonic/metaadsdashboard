import { Globe } from "lucide-react";
import { redirect } from "next/navigation";
import PagePlaceholder from "@/components/PagePlaceholder";
import GoogleAdsDashboard from "@/components/google-ads/GoogleAdsDashboard";
import { getCurrentUser, hasFullAccess } from "@/lib/auth/currentUser";

export default async function GoogleAdsPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");

  const isClient = me.role === "client";
  return (
    <PagePlaceholder
      icon={Globe}
      title="Google Ads"
      subtitle={isClient ? "Your Google Ads performance" : "Campaigns, keywords, search terms, audiences and account health"}
    >
      <GoogleAdsDashboard isClient={isClient} canConnect={hasFullAccess(me.role)} />
    </PagePlaceholder>
  );
}
