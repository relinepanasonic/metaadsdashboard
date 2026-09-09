"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export interface SeoSite {
  id: string;
  domain: string;
  site_url: string | null;
  label: string;
  status: "none" | "pending" | "connected" | "error";
  publish_url: string | null;
  publish_secret: string | null;
}

interface SeoSiteCtx {
  sites: SeoSite[];
  selected: string;
  setSelected: (id: string) => void;
  selectedSite: SeoSite | null;
  loading: boolean;
  reload: () => void;
}

const Ctx = createContext<SeoSiteCtx>({
  sites: [],
  selected: "",
  setSelected: () => {},
  selectedSite: null,
  loading: true,
  reload: () => {},
});

export function useSeoSite() {
  return useContext(Ctx);
}

const LAST_SITE_KEY = "seo:lastSiteId";

export default function SeoSiteProvider({ children }: { children: ReactNode }) {
  const [sites, setSites] = useState<SeoSite[]>([]);
  const [selected, setSelectedState] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/seo/gsc/sites", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) return;
        const list = j.sites as SeoSite[];
        setSites(list);
        setSelectedState((prev) => {
          if (prev && list.some((s) => s.id === prev)) return prev;
          const remembered = typeof window !== "undefined" ? window.localStorage.getItem(LAST_SITE_KEY) : null;
          if (remembered && list.some((s) => s.id === remembered)) return remembered;
          return list[0]?.id ?? "";
        });
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function setSelected(id: string) {
    setSelectedState(id);
    try {
      window.localStorage.setItem(LAST_SITE_KEY, id);
    } catch {
      // best-effort only
    }
  }

  const selectedSite = sites.find((s) => s.id === selected) ?? null;

  return (
    <Ctx.Provider value={{ sites, selected, setSelected, selectedSite, loading, reload: load }}>
      {children}
    </Ctx.Provider>
  );
}
