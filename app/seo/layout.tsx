import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/currentUser";
import SeoSiteProvider from "@/components/seo/SeoSiteProvider";
import SeoHeader from "@/components/seo/SeoHeader";
import SeoTabs from "@/components/seo/SeoTabs";

export default async function SeoLayout({ children }: { children: React.ReactNode }) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  const isClient = me.role === "client";

  return (
    <SeoSiteProvider isClient={isClient} clientName={me.clientName ?? ""}>
      <div className="relative z-10 mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
        <SeoHeader />
        <SeoTabs />
        {children}
      </div>
    </SeoSiteProvider>
  );
}
