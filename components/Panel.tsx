"use client";

import { type ReactNode } from "react";

interface PanelProps {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export default function Panel({
  title,
  subtitle,
  right,
  children,
  className = "",
  bodyClassName = "",
}: PanelProps) {
  return (
    <div className={`glass-panel glass-panel-hover flex flex-col p-4 sm:p-5 ${className}`}>
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
        </div>
        {right}
      </div>
      <div className={`min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
    </div>
  );
}
