import { redirect } from "next/navigation";
import { Camera } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/currentUser";
import SocialTabs from "@/components/social/SocialTabs";

export default async function SocialMediaLayout({ children }: { children: React.ReactNode }) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  const isClient = me.role === "client";

  return (
    <div className="relative z-10 mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: "rgba(59,130,246,0.12)", boxShadow: "0 0 0 1px rgba(59,130,246,0.4)" }}>
          <Camera size={22} className="text-cyan-400" />
        </span>
        <div>
          <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl">Social Media</h1>
          <p className="text-xs text-slate-500">
            {isClient ? `Instagram performance for ${me.clientName ?? "your brand"}` : "Organic performance per client, and scheduled posting to Instagram, Facebook, Threads and TikTok"}
          </p>
        </div>
      </div>

      {!isClient && <SocialTabs />}
      {children}
    </div>
  );
}
