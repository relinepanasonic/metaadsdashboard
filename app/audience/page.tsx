import { Users2 } from "lucide-react";
import { redirect } from "next/navigation";
import PagePlaceholder from "@/components/PagePlaceholder";
import AudienceTable from "@/components/AudienceTable";
import { getCurrentUser } from "@/lib/auth/currentUser";

export default async function AudiencePage() {
  const me = await getCurrentUser();
  if (me?.role === "client") redirect("/");

  return (
    <PagePlaceholder
      icon={Users2}
      title="Audience"
      subtitle="Value-based custom audience data · Meta CSV template"
    >
      <AudienceTable />
    </PagePlaceholder>
  );
}
