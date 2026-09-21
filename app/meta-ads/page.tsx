import CampaignsTable from "@/components/CampaignsTable";
import { getCurrentUser } from "@/lib/auth/currentUser";

export default async function MetaAdsDashboardPage() {
  const me = await getCurrentUser();
  // A client's table reads only their own campaigns; staff pick accounts and clients.
  return <CampaignsTable mode={me?.role === "client" ? "client" : "admin"} />;
}
