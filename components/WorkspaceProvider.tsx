"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

// Each client is a workspace. The sidebar switcher picks one, and pages that work per client
// (SEO, the Scheduler, ...) follow it. A Client login has exactly one brand and no switcher.

export interface Workspace {
  id: string;
  name: string;
}

interface WorkspaceCtx {
  workspaces: Workspace[];
  workspaceId: string; // "" until the list has loaded, or for a Client login
  workspace: Workspace | null;
  setWorkspace: (id: string) => void;
  loading: boolean;
  isClient: boolean;
}

const Ctx = createContext<WorkspaceCtx>({ workspaces: [], workspaceId: "", workspace: null, setWorkspace: () => {}, loading: true, isClient: false });

export function useWorkspace() {
  return useContext(Ctx);
}

const KEY = "workspace:clientId";

export default function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [loading, setLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const me = await fetch("/api/me", { cache: "no-store" }).then((r) => r.json());
        if (!alive) return;
        if (!me.ok) return; // not logged in (login pages have no shell anyway)
        if (me.user.role === "client") {
          setIsClient(true);
          return;
        }
        const res = await fetch("/api/clients", { cache: "no-store" }).then((r) => r.json());
        if (!alive || !res.ok) return;
        const list: Workspace[] = (res.clients as { id: string; name: string }[]).map((c) => ({ id: c.id, name: c.name }));
        setWorkspaces(list);
        let remembered: string | null = null;
        try {
          remembered = window.localStorage.getItem(KEY);
        } catch {
          // storage can be blocked; fall back to the first client
        }
        setWorkspaceId(remembered && list.some((w) => w.id === remembered) ? remembered : list[0]?.id ?? "");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const setWorkspace = useCallback((id: string) => {
    setWorkspaceId(id);
    try {
      window.localStorage.setItem(KEY, id);
    } catch {
      // best-effort only
    }
  }, []);

  const workspace = useMemo(() => workspaces.find((w) => w.id === workspaceId) ?? null, [workspaces, workspaceId]);

  return <Ctx.Provider value={{ workspaces, workspaceId, workspace, setWorkspace, loading, isClient }}>{children}</Ctx.Provider>;
}
