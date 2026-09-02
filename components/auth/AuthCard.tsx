import { type ReactNode } from "react";
import Image from "next/image";

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
            className="mb-3 grid h-16 w-16 place-items-center overflow-hidden rounded-xl"
            style={{ boxShadow: "0 0 0 1px rgba(59,130,246,0.4)" }}
          >
            <Image src="/logo-icon.png" alt="Reline Meta Project" width={64} height={64} className="h-full w-full object-cover" />
          </span>
          <h1 className="text-lg font-black text-white">{title}</h1>
          <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
        </div>
        <div className="glass-panel p-6">{children}</div>
      </div>
    </main>
  );
}
