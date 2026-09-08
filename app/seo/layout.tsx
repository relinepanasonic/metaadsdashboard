import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/currentUser";
import SeoTabs from "@/components/seo/SeoTabs";

export default async function SeoLayout({ children }: { children: React.ReactNode }) {
  const me = await getCurrentUser();
  if (me?.role === "client") redirect("/");

  return (
    <div className="relative z-10 mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
      {/* Module header */}
      <div className="mb-6 flex items-center gap-3">
        <span
          className="grid h-11 w-11 place-items-center rounded-xl"
          style={{ background: "rgba(34,211,238,0.12)", boxShadow: "0 0 0 1px rgba(34,211,238,0.4)" }}
        >
          <Search size={22} className="text-cyan-400" />
        </span>
        <div>
          <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl">
            SEO <span className="neon-text-cyan">#1</span>
          </h1>
          <p className="text-xs text-slate-500">Organic search + Generative Engine Optimization, wired to your paid Meta data</p>
        </div>
      </div>

      <SeoTabs />
      {children}
    </div>
  );
}
