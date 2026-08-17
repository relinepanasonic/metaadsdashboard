import { Globe } from "lucide-react";
import PagePlaceholder from "@/components/PagePlaceholder";

export default function GoogleAdsPage() {
  return (
    <PagePlaceholder
      icon={Globe}
      title="Google Ads"
      subtitle="Connect via google-ads-api Node SDK"
      status="Coming Soon"
    >
      <div className="glass-panel p-6 text-sm text-slate-400">
        Google Ads integration is scaffolded in{" "}
        <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-cyan-300">lib/services/googleAds.ts</code>.
        We&apos;ll wire the live connection after Meta Ads is fully connected.
      </div>
    </PagePlaceholder>
  );
}
