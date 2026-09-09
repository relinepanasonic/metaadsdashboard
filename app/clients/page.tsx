import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import PagePlaceholder from "@/components/PagePlaceholder";
import ClientsManager from "@/components/ClientsManager";
import { getCurrentUser } from "@/lib/auth/currentUser";

export default async function ClientsPage() {
  const me = await getCurrentUser();
  if (!me || me.role === "client") redirect("/");

  return (
    <PagePlaceholder icon={Building2} title="Clients" subtitle="The master roster — connects each client to SEO #1, Meta Ads, and Google Ads">
      <ClientsManager canDelete={me.role === "founder" || me.role === "superadmin"} />
    </PagePlaceholder>
  );
}
