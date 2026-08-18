import DashboardClient from "@/components/DashboardClient";
import ClientOverview from "@/components/ClientOverview";
import { getCurrentUser } from "@/lib/auth/currentUser";

export default async function Home() {
  const me = await getCurrentUser();

  if (me?.role === "client" && me.clientName) {
    return (
      <main className="min-h-screen">
        <ClientOverview clientName={me.clientName} />
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <DashboardClient />
    </main>
  );
}
