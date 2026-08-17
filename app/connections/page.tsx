import { Plug } from "lucide-react";
import PagePlaceholder from "@/components/PagePlaceholder";

const CONNECTIONS = [
  { name: "Meta Graph API", detail: "act_1153490826516966", status: "Mock", color: "#fbbf24" },
  { name: "Google Ads API", detail: "google-ads-api SDK", status: "Not linked", color: "#fb7185" },
  { name: "Supabase", detail: "ProfMetaAds", status: "Connected", color: "#34d399" },
  { name: "Next.js API", detail: "/api/dashboard", status: "Connected", color: "#34d399" },
];

export default function ConnectionsPage() {
  return (
    <PagePlaceholder icon={Plug} title="Connections" subtitle="Data source status">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {CONNECTIONS.map((c) => (
          <div key={c.name} className="glass-panel flex items-center justify-between p-4">
            <div>
              <div className="text-sm font-semibold text-slate-100">{c.name}</div>
              <div className="text-[11px] text-slate-500">{c.detail}</div>
            </div>
            <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: c.color }}>
              <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
              {c.status}
            </span>
          </div>
        ))}
      </div>
    </PagePlaceholder>
  );
}
