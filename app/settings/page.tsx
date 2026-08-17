import { Settings } from "lucide-react";
import PagePlaceholder from "@/components/PagePlaceholder";

export default function SettingsPage() {
  return (
    <PagePlaceholder icon={Settings} title="Settings" subtitle="App configuration">
      <div className="glass-panel p-6 text-sm text-slate-400">
        Currency, date range defaults, and account preferences will live here.
      </div>
    </PagePlaceholder>
  );
}
