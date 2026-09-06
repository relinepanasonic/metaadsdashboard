import { Bot, Quote, Bell } from "lucide-react";
import Panel from "@/components/Panel";
import AeoScoreDonut from "@/components/seo/AeoScoreDonut";
import AiEngineBar from "@/components/seo/AiEngineBar";
import CitationTable from "@/components/seo/CitationTable";
import AlertList from "@/components/seo/AlertList";
import { aeoScore, aiEngines, citations, geoAlerts } from "@/lib/seo/mock";

export default function GeoPage() {
  const mentioned = citations.filter((c) => c.mentioned).length;

  return (
    <div className="flex flex-col gap-4">
      {/* Score donut + engine breakdown */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel
          title="AEO Score"
          subtitle="Answer Engine Optimization — overall AI mention rate"
          bodyClassName="h-[280px]"
        >
          <AeoScoreDonut score={aeoScore} />
        </Panel>

        <Panel
          title="AI Engine Breakdown"
          subtitle="Brand visibility across generative engines"
          className="lg:col-span-2"
          bodyClassName="h-[280px]"
          right={
            <span className="flex items-center gap-1.5 rounded-md bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-300">
              <Bot size={12} /> 4 engines tracked
            </span>
          }
        >
          <AiEngineBar data={aiEngines} />
        </Panel>
      </div>

      {/* Citation tracker */}
      <Panel
        title="Citation Tracker"
        subtitle={`Brand mentioned in ${mentioned} of ${citations.length} tracked prompts`}
        right={<Quote size={16} className="text-slate-500" />}
      >
        <CitationTable rows={citations} />
      </Panel>

      {/* Actionable alerts */}
      <Panel title="Actionable Alerts" subtitle="Fix these to raise AI visibility" right={<Bell size={16} className="text-amber-400" />}>
        <AlertList alerts={geoAlerts} />
      </Panel>
    </div>
  );
}
