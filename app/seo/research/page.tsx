import { Trophy } from "lucide-react";
import Panel from "@/components/Panel";
import KeywordResearch from "@/components/seo/KeywordResearch";
import SerpTable from "@/components/seo/SerpTable";
import { keywordResults, serpTable } from "@/lib/seo/mock";

export default function ResearchPage() {
  return (
    <div className="flex flex-col gap-4">
      <KeywordResearch results={keywordResults} />

      <Panel
        title="Competitor SERP — top 10"
        subtitle="Current ranking pages for &quot;panasonic ac 1 pk murah&quot;"
        right={<Trophy size={16} className="text-amber-400" />}
      >
        <SerpTable rows={serpTable} />
      </Panel>
    </div>
  );
}
