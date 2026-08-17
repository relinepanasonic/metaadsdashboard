import { Share2, CheckCircle2, Circle, ArrowRight } from "lucide-react";
import PagePlaceholder from "@/components/PagePlaceholder";

const STEPS = [
  { done: true, title: "Mock data service live", desc: "lib/services/metaAds.ts returns structured PlatformDataset" },
  { done: false, title: "Create Meta App + System User token", desc: "developers.facebook.com → App → ads_read permission → long-lived token" },
  { done: false, title: "Add META_ACCESS_TOKEN + META_AD_ACCOUNT_ID to Vercel", desc: "Environment Variables (server-side, not NEXT_PUBLIC)" },
  { done: false, title: "Swap fetchMetaAdsData() body for Graph API call", desc: "GET /act_<id>/insights?fields=spend,impressions,clicks,actions" },
  { done: false, title: "Map response → PlatformDataset", desc: "UI stays untouched because the shape is identical" },
];

export default function MetaAdsPage() {
  return (
    <PagePlaceholder
      icon={Share2}
      title="Meta Ads"
      subtitle="Account act_1153490826516966 · Prof Toko Online"
      status="Mock Data"
    >
      <div className="glass-panel p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-200">Go-Live Checklist</h3>
        <div className="flex flex-col gap-3">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-start gap-3">
              {s.done ? (
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-400" />
              ) : (
                <Circle size={18} className="mt-0.5 shrink-0 text-slate-600" />
              )}
              <div>
                <div className={`text-sm font-medium ${s.done ? "text-slate-300 line-through" : "text-slate-100"}`}>
                  {s.title}
                </div>
                <div className="text-xs text-slate-500">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 flex items-center gap-2 rounded-lg bg-cyan-500/[0.06] px-4 py-3 text-xs text-cyan-300">
          <ArrowRight size={14} />
          Next action: generate your Meta System User access token, then paste it here to wire the live connection.
        </div>
      </div>
    </PagePlaceholder>
  );
}
