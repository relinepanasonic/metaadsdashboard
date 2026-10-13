"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useWorkspace } from "@/components/WorkspaceProvider";

export interface SeoSite {
  id: string;
  domain: string;
  site_url: string | null;
  label: string;
  status: "none" | "pending" | "connected" | "error";
  publish_url: string | null;
  publish_secret: string | null;
  client_id: string | null;
  publish_cadence_per_week: number;
  last_auto_published_at: string | null;
  parent_site_id: string | null;
  path_prefix: string | null;
}

export interface Brand {
  id: string; // "" means "Unassigned" — sites with no client_id
  name: string;
  sites: SeoSite[];
}

interface SeoSiteCtx {
  sites: SeoSite[];
  brands: Brand[];
  selectedBrand: string;
  setSelectedBrand: (id: string) => void;
  sitesForSelectedBrand: SeoSite[];
  selected: string;
  setSelected: (id: string) => void;
  selectedSite: SeoSite | null;
  loading: boolean;
  reload: () => void;
  isClient: boolean; // a Client user: one brand, read-only
  clientName: string;
}

const Ctx = createContext<SeoSiteCtx>({
  sites: [],
  brands: [],
  selectedBrand: "",
  setSelectedBrand: () => {},
  sitesForSelectedBrand: [],
  selected: "",
  setSelected: () => {},
  selectedSite: null,
  loading: true,
  reload: () => {},
  isClient: false,
  clientName: "",
});

export function useSeoSite() {
  return useContext(Ctx);
}

const LAST_SITE_KEY = "seo:lastSiteId";
const UNASSIGNED_ID = "";

// The brand is the sidebar workspace; this provider only loads the websites and tracks which one
// of the workspace's sites is selected.
export default function SeoSiteProvider({ children, isClient = false, clientName = "" }: { children: ReactNode; isClient?: boolean; clientName?: string }) {
  const ws = useWorkspace();
  const selectedBrand = isClient ? "" : ws.workspaceId;
  // The list is already limited to the client's own sites by the API, so for a
  // client there is no brand filtering to do at all.
  const inBrand = (s: SeoSite, brandId: string) => isClient || (s.client_id ?? UNASSIGNED_ID) === brandId;
  const [sites, setSites] = useState<SeoSite[]>([]);
  const [selected, setSelectedState] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/seo/gsc/sites", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setSites(j.ok ? j.sites : []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const brands = useMemo<Brand[]>(
    () => ws.workspaces.map((c) => ({ id: c.id, name: c.name, sites: sites.filter((s) => s.client_id === c.id) })),
    [ws.workspaces, sites]
  );

  const sitesForSelectedBrand = useMemo(
    () => sites.filter((s) => inBrand(s, selectedBrand)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sites, selectedBrand, isClient]
  );

  // Whenever the workspace or the site list changes, keep a valid site selected.
  useEffect(() => {
    const remembered = typeof window !== "undefined" ? window.localStorage.getItem(LAST_SITE_KEY) : null;
    setSelectedState((prev) => {
      if (prev && sitesForSelectedBrand.some((s) => s.id === prev)) return prev;
      if (remembered && sitesForSelectedBrand.some((s) => s.id === remembered)) return remembered;
      return sitesForSelectedBrand[0]?.id ?? "";
    });
  }, [sitesForSelectedBrand]);

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
    <Ctx.Provider
      value={{
        sites,
        brands,
        selectedBrand,
        setSelectedBrand: ws.setWorkspace,
        sitesForSelectedBrand,
        selected,
        setSelected,
        selectedSite,
        loading: loading || ws.loading,
        reload: load,
        isClient,
        clientName,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
