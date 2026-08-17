import { type LucideIcon } from "lucide-react";

interface PagePlaceholderProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  status?: string;
  children?: React.ReactNode;
}

export default function PagePlaceholder({
  icon: Icon,
  title,
  subtitle,
  status,
  children,
}: PagePlaceholderProps) {
  return (
    <div className="relative z-10 mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center gap-3">
        <span
          className="grid h-11 w-11 place-items-center rounded-xl"
          style={{ background: "rgba(59,130,246,0.12)", boxShadow: "0 0 0 1px rgba(59,130,246,0.4)" }}
        >
          <Icon size={22} className="text-cyan-400" />
        </span>
        <div>
          <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl">{title}</h1>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        {status && (
          <span className="ml-auto rounded-full bg-amber-500/15 px-3 py-1 text-[11px] font-bold uppercase text-amber-400">
            {status}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
