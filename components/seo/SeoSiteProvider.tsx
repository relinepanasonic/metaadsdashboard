"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface SiteConnection {
  id: string;
  site_url: string;
  label: string;
  status: "pending" | "connected" | "error";
}

interface SeoSiteCtx {
  sites: SiteConnection[];
  selected: string;
  setSelected: (id: string) => void;
  loading: boolean;
  selectedSiteUrl: string;
}

const Ctx = createContext<SeoSiteCtx>({
  sites: [],
  selected: "",
  setSelected: () => {},
  loading: true,
  selectedSiteUrl: "",
});

export function useSeoSite() {
  return useContext(Ctx);
}

export default function SeoSiteProvider({ children }: { children: ReactNode }) {
  const [sites, setSites] = useState<SiteConnection[]>([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/seo/gsc/sites", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          const connected = (j.sites as SiteConnection[]).filter((s) => s.status === "connected");
          setSites(connected);
          if (connected[0]) setSelected(connected[0].id);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const selectedSiteUrl = sites.find((s) => s.id === selected)?.site_url ?? "";

  return (
    <Ctx.Provider value={{ sites, selected, setSelected, loading, selectedSiteUrl }}>
      {children}
    </Ctx.Provider>
  );
}
