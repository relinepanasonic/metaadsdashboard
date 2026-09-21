"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

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
const LAST_BRAND_KEY = "seo:lastBrandId";
const UNASSIGNED_ID = "";

export default function SeoSiteProvider({ children, isClient = false, clientName = "" }: { children: ReactNode; isClient?: boolean; clientName?: string }) {
  // The list is already limited to the client's own sites by the API, so for a
  // client there is no brand filtering to do at all.
  const inBrand = (s: SeoSite, brandId: string) => isClient || (s.client_id ?? UNASSIGNED_ID) === brandId;
  const [sites, setSites] = useState<SeoSite[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [selected, setSelectedState] = useState("");
  const [selectedBrand, setSelectedBrandState] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/seo/gsc/sites", { cache: "no-store" }).then((r) => r.json()),
      isClient ? Promise.resolve({ ok: false }) : fetch("/api/clients", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([sitesJson, clientsJson]) => {
        const list: SeoSite[] = sitesJson.ok ? sitesJson.sites : [];
        const clientList: { id: string; name: string }[] = clientsJson.ok ? clientsJson.clients : [];
        setSites(list);
        setClients(clientList);

        const remembered = typeof window !== "undefined" ? window.localStorage.getItem(LAST_BRAND_KEY) : null;
        const brandIds = new Set(clientList.map((c) => c.id));
        const hasUnassigned = list.some((s) => !s.client_id);

        let nextBrand = "";
        if (remembered !== null && (brandIds.has(remembered) || (remembered === UNASSIGNED_ID && hasUnassigned))) {
          nextBrand = remembered;
        } else {
          // Default to a brand that actually has a website, so the header
          // doesn't land on an empty "connect website first" state.
          const brandWithSite = clientList.find((c) => list.some((s) => s.client_id === c.id));
          if (brandWithSite) nextBrand = brandWithSite.id;
          else if (hasUnassigned) nextBrand = UNASSIGNED_ID;
          else if (clientList[0]) nextBrand = clientList[0].id;
        }
        setSelectedBrandState(nextBrand);

        const rememberedSite = typeof window !== "undefined" ? window.localStorage.getItem(LAST_SITE_KEY) : null;
        const sitesInBrand = list.filter((s) => inBrand(s, nextBrand));
        setSelectedState((prev) => {
          if (rememberedSite && sitesInBrand.some((s) => s.id === rememberedSite)) return rememberedSite;
          if (prev && sitesInBrand.some((s) => s.id === prev)) return prev;
          return sitesInBrand[0]?.id ?? "";
        });
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const brands = useMemo<Brand[]>(() => {
    const list: Brand[] = clients.map((c) => ({ id: c.id, name: c.name, sites: sites.filter((s) => s.client_id === c.id) }));
    const unassigned = sites.filter((s) => !s.client_id);
    if (unassigned.length > 0) list.push({ id: UNASSIGNED_ID, name: "Unassigned", sites: unassigned });
    return list;
  }, [clients, sites]);

  const sitesForSelectedBrand = useMemo(
    () => sites.filter((s) => inBrand(s, selectedBrand)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sites, selectedBrand, isClient]
  );

  function setSelectedBrand(id: string) {
    setSelectedBrandState(id);
    try {
      window.localStorage.setItem(LAST_BRAND_KEY, id);
    } catch {
      // best-effort only
    }
    const sitesInBrand = sites.filter((s) => inBrand(s, id));
    setSelected(sitesInBrand[0]?.id ?? "");
  }

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
      value={{ sites, brands, selectedBrand, setSelectedBrand, sitesForSelectedBrand, selected, setSelected, selectedSite, loading, reload: load, isClient, clientName }}
    >
      {children}
    </Ctx.Provider>
  );
}
