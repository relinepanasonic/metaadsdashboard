import { redirect } from "next/navigation";
import { Share2 } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/currentUser";
import MetaAdsTabs from "@/components/meta-ads/MetaAdsTabs";

export default async function MetaAdsLayout({ children }: { children: React.ReactNode }) {
  const me = await getCurrentUser();
  if (me?.role === "client") redirect("/");

  return (
    <div className="relative z-10 mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
      {/* Module header */}
      <div className="mb-6 flex items-center gap-3">
        <span
          className="grid h-11 w-11 place-items-center rounded-xl"
          style={{ background: "rgba(59,130,246,0.12)", boxShadow: "0 0 0 1px rgba(59,130,246,0.4)" }}
        >
          <Share2 size={22} className="text-cyan-400" />
        </span>
        <div>
          <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl">Meta Ads</h1>
          <p className="text-xs text-slate-500">Campaigns, custom audiences, and WhatsApp leads from your Meta ad accounts</p>
        </div>
      </div>

      <MetaAdsTabs />
      {children}
    </div>
  );
}
