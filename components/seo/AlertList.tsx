import { AlertTriangle, AlertOctagon, Info } from "lucide-react";
import type { SeoAlert, AlertLevel } from "@/lib/seo/mock";

const STYLES: Record<AlertLevel, { icon: typeof Info; color: string; ring: string }> = {
  critical: { icon: AlertOctagon, color: "#fb7185", ring: "rgba(251,113,133,0.3)" },
  warning: { icon: AlertTriangle, color: "#fbbf24", ring: "rgba(251,191,36,0.3)" },
  info: { icon: Info, color: "#22d3ee", ring: "rgba(34,211,238,0.3)" },
};

export default function AlertList({ alerts }: { alerts: SeoAlert[] }) {
  return (
    <div className="flex flex-col gap-2.5">
      {alerts.map((a, i) => {
        const s = STYLES[a.level];
        const Icon = s.icon;
        return (
          <div key={i} className="flex items-start gap-3 rounded-lg p-3" style={{ boxShadow: `inset 0 0 0 1px ${s.ring}` }}>
            <Icon size={16} className="mt-0.5 shrink-0" style={{ color: s.color }} />
            <div>
              <div className="text-sm font-semibold" style={{ color: s.color }}>{a.title}</div>
              <div className="mt-0.5 text-xs text-slate-400">{a.detail}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
