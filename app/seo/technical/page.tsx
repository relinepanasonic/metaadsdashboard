import { Gauge, Bot, Check, X } from "lucide-react";
import Panel from "@/components/Panel";
import CoreWebVitals from "@/components/seo/CoreWebVitals";
import AlertList from "@/components/seo/AlertList";
import { coreWebVitals, performanceScore, crawlerChecklist, technicalAlerts } from "@/lib/seo/mock";

export default function TechnicalPage() {
  const aiBotsAllowed = crawlerChecklist.filter((c) => c.allowed).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Core Web Vitals" subtitle="Mobile vs. desktop field data" right={<Gauge size={16} className="text-cyan-400" />}>
          <CoreWebVitals metrics={coreWebVitals} performanceScore={performanceScore} />
        </Panel>

        <Panel
          title="AI Crawler Permissions"
          subtitle={`robots.txt — ${aiBotsAllowed}/${crawlerChecklist.length} bots allowed`}
          right={<Bot size={16} className="text-slate-500" />}
        >
          <div className="flex flex-col gap-2">
            {crawlerChecklist.map((c) => (
              <div key={c.bot} className="flex items-center gap-3 rounded-lg border border-white/[0.06] px-3 py-2.5">
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${c.allowed ? "bg-emerald-500/15" : "bg-rose-500/15"}`}>
                  {c.allowed ? <Check size={14} className="text-emerald-400" /> : <X size={14} className="text-rose-400" />}
                </span>
                <div>
                  <div className="text-xs font-semibold text-slate-100">{c.bot}</div>
                  <div className="text-[10px] text-slate-500">{c.purpose}</div>
                </div>
                <span className={`ml-auto text-[11px] font-semibold ${c.allowed ? "text-emerald-400" : "text-rose-400"}`}>
                  {c.allowed ? "Allowed" : "Blocked"}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Technical Alerts" subtitle="Blocking issues for crawlers & AI engines">
        <AlertList alerts={technicalAlerts} />
      </Panel>
    </div>
  );
}
