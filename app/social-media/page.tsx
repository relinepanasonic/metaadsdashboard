import { getCurrentUser } from "@/lib/auth/currentUser";
import SocialDashboard from "@/components/social/SocialDashboard";

// The header and tabs come from layout.tsx.
export default async function SocialMediaPage() {
  const me = await getCurrentUser();
  return <SocialDashboard canManage={me?.role !== "client"} />;
}
