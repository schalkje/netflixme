"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { CatalogItem, ConfigStatus, UserStatus } from "@/lib/types";
import type { ActionKind } from "@/lib/actions";
import { DEFAULT_FILTERS, toQueryString, type Filters } from "./filters";
import FilterBar from "./FilterBar";
import TitleCard from "./TitleCard";
import CsvImport from "./CsvImport";

const ACTION_STATUS: Partial<Record<ActionKind, UserStatus | null>> = {
  mylist: "mylist",
  seen: "seen",
  dropped: "dropped",
  hidden: "hidden",
  remove: null,
};

export default function CatalogApp() {
  const [config, setConfig] = useState<ConfigStatus | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [showCsv, setShowCsv] = useState(false);
  const didInitialConnect = useRef(false);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }, []);

  const loadHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/health");
      setConfig((await res.json()) as ConfigStatus);
    } catch {
      /* ignore */
    }
  }, []);

  const loadCatalog = useCallback(async (f: Filters) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/catalog?${toQueryString(f)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load catalog");
      setItems(data.items as CatalogItem[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load catalog");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load.
  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  // Reload catalog when filters change (debounced for the search box).
  useEffect(() => {
    const id = setTimeout(() => loadCatalog(filters), 300);
    return () => clearTimeout(id);
  }, [filters, loadCatalog]);

  // If we just returned from Simkl OAuth, sync once.
  useEffect(() => {
    if (didInitialConnect.current) return;
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("connected") === "1") {
      didInitialConnect.current = true;
      window.history.replaceState({}, "", window.location.pathname);
      flash("Connected to Simkl — syncing your library…");
      doSync();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patchFilters = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));

  async function doSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      flash(`Synced: ${data.seen} seen · ${data.mylist} my-list · ${data.dropped} hidden`);
      await loadHealth();
      await loadCatalog(filters);
    } catch (e) {
      flash(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function disconnect() {
    await fetch("/api/auth/simkl/disconnect", { method: "POST" });
    await loadHealth();
    flash("Disconnected from Simkl");
  }

  function visibleAfter(status: UserStatus | null): boolean {
    if (filters.mylistOnly) return status === "mylist";
    if (status === "seen" && !filters.showSeen) return false;
    if (status === "dropped" || status === "hidden") return false;
    return true;
  }

  async function handleAction(item: CatalogItem, action: ActionKind) {
    setBusy((b) => new Set(b).add(item.key));
    try {
      const res = await fetch("/api/title/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          type: item.type,
          title: item.title,
          imdbId: item.imdbId,
          tmdbId: item.key.startsWith("tmdb:") ? Number(item.key.split(":")[2]) : undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Action failed");
      }
      const newStatus = ACTION_STATUS[action] ?? null;
      setItems((cur) =>
        cur
          .map((it) => (it.key === item.key ? { ...it, status: newStatus } : it))
          .filter((it) => (it.key === item.key ? visibleAfter(newStatus) : true))
      );
    } catch (e) {
      flash(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy((b) => {
        const n = new Set(b);
        n.delete(item.key);
        return n;
      });
    }
  }

  // ----- onboarding (no TMDB key yet) -----
  if (config && !config.hasTmdb) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="mb-3 text-3xl font-bold">
          netflix<span className="text-brand">me</span>
        </h1>
        <p className="mb-6 text-muted">
          A better Netflix UI that hides what you&apos;ve seen, manages your list, and shows IMDb
          scores. To get started, add your free API keys.
        </p>
        <Link href="/setup" className="btn-primary mx-auto w-fit px-6 py-3 text-base">
          Open Setup →
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 pb-24 pt-4 sm:px-6">
      {/* Header */}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            netflix<span className="text-brand">me</span>
          </h1>
          <p className="text-xs text-muted">
            Netflix · {config?.region ?? "—"} ·{" "}
            {config?.simklConnected ? "Simkl connected" : "Simkl not connected"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {config?.simklConnected ? (
            <>
              <button className="btn-ghost" onClick={doSync} disabled={syncing}>
                {syncing ? "Syncing…" : "↻ Sync"}
              </button>
              <button className="btn-ghost" onClick={disconnect}>
                Disconnect
              </button>
            </>
          ) : (
            <a className="btn-primary" href="/api/auth/simkl">
              Connect Simkl
            </a>
          )}
          <button className="btn-ghost" onClick={() => setShowCsv(true)}>
            Import CSV
          </button>
          <Link className="btn-ghost" href="/setup">
            Setup
          </Link>
        </div>
      </header>

      {!config?.simklConnected && (
        <div className="mb-4 rounded-lg border border-edge bg-panel/60 p-3 text-sm text-muted">
          Connect Simkl to auto-hide what you&apos;ve already watched and sync your list across
          devices. Install Simkl&apos;s “Enhancer for Netflix” extension to auto-track desktop
          watching, and use <b>Import CSV</b> for TV/phone history.
        </div>
      )}

      <FilterBar filters={filters} onChange={patchFilters} />

      {/* Grid */}
      <section className="mt-5">
        {loading ? (
          <div className="py-20 text-center text-muted">Loading catalog…</div>
        ) : error ? (
          <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-4 text-sm text-red-300">
            {error}
          </div>
        ) : items.length === 0 ? (
          <div className="py-20 text-center text-muted">
            Nothing to show with the current filters.
            {!filters.showSeen && " You may have seen everything here — try “Showing seen”."}
          </div>
        ) : (
          <>
            <p className="mb-3 text-xs text-muted">{items.length} titles</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {items.map((item) => (
                <TitleCard
                  key={item.key}
                  item={item}
                  busy={busy.has(item.key)}
                  onAction={(action) => handleAction(item, action)}
                />
              ))}
            </div>
            {filters.pages < 5 && (
              <div className="mt-6 flex justify-center">
                <button
                  className="btn-ghost"
                  onClick={() => patchFilters({ pages: filters.pages + 1 })}
                >
                  Load more
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {showCsv && (
        <CsvImport
          onClose={() => setShowCsv(false)}
          onDone={() => {
            loadHealth();
            loadCatalog(filters);
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full bg-white/95 px-4 py-2 text-sm font-medium text-black shadow-lg">
          {toast}
        </div>
      )}
    </main>
  );
}
