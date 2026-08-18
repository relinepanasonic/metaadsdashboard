import { type ReactNode } from "react";
import { Activity } from "lucide-react";

export default function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span
            className="mb-3 grid h-12 w-12 place-items-center rounded-xl"
            style={{ background: "rgba(59,130,246,0.12)", boxShadow: "0 0 0 1px rgba(59,130,246,0.4)" }}
          >
            <Activity size={24} className="text-cyan-400" />
          </span>
          <h1 className="text-lg font-black text-white">{title}</h1>
          <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
        </div>
        <div className="glass-panel p-6">{children}</div>
      </div>
    </main>
  );
}
