import { mutate } from "./db";
import { resolveTitle, type TitleRef } from "./resolve";
import { canonicalKey } from "./ids";
import { mapLimit } from "./concurrency";
import type { DbShape, StateSource } from "./types";

export interface HistoryEntry {
  title: string;
  netflixId?: string;
}

export interface IngestSummary {
  total: number;
  matched: string[];
  unmatched: string[];
}

// Statuses we never silently override when account data comes in — the user set
// these on purpose inside netflixme.
function isProtected(status?: string): boolean {
  return status === "dropped" || status === "hidden";
}

function normalizeHistory(entries: (string | HistoryEntry)[]): HistoryEntry[] {
  const byTitle = new Map<string, HistoryEntry>();
  for (const e of entries) {
    const entry = typeof e === "string" ? { title: e } : e;
    const title = entry.title?.trim();
    if (!title) continue;
    if (!byTitle.has(title)) byTitle.set(title, { title, netflixId: entry.netflixId });
  }
  return [...byTitle.values()];
}

async function resolveAll<T extends { title: string }>(
  items: T[]
): Promise<{ item: T; ref: TitleRef }[]> {
  const resolved = await mapLimit(items, 6, async (item) => {
    const ref = await resolveTitle(item.title);
    return ref ? { item, ref } : null;
  });
  return resolved.filter((r): r is { item: T; ref: TitleRef } => r !== null);
}

// Stash a learned Netflix title id on the titles cache so Play can deep-link
// exactly instead of falling back to a Netflix search.
function stashNetflixId(db: DbShape, ref: TitleRef, netflixId?: string) {
  if (!netflixId) return;
  const cacheKey = `tmdb:${ref.type}:${ref.tmdbId}`;
  const existing = db.titles[cacheKey];
  if (existing) {
    existing.netflixId = netflixId;
  } else {
    db.titles[cacheKey] = {
      key: cacheKey,
      type: ref.type,
      title: ref.title,
      tmdbId: ref.tmdbId,
      netflixId,
      lastRefreshed: 0, // force enrichment on next catalog build
    };
  }
}

// Mark watched titles as seen (cumulative — history only grows).
export async function ingestHistory(
  entries: (string | HistoryEntry)[],
  source: StateSource
): Promise<IngestSummary> {
  const items = normalizeHistory(entries);
  const resolved = await resolveAll(items);
  const matchedTitles = new Set(resolved.map((r) => r.item.title));
  const now = Date.now();

  await mutate((db) => {
    for (const { item, ref } of resolved) {
      stashNetflixId(db, ref, item.netflixId);
      const key = canonicalKey({ tmdbId: ref.tmdbId, type: ref.type });
      if (isProtected(db.userState[key]?.status)) continue;
      db.userState[key] = {
        status: "seen",
        source,
        updatedAt: now,
        type: ref.type,
        title: ref.title,
        tmdbId: ref.tmdbId,
        netflixId: item.netflixId,
      };
    }
  });

  return {
    total: items.length,
    matched: [...matchedTitles],
    unmatched: items.map((i) => i.title).filter((t) => !matchedTitles.has(t)),
  };
}

// Reconcile the My List bucket with what Netflix currently has: add new ones,
// remove account-sourced entries that are no longer on the list.
export async function ingestMyList(titles: string[]): Promise<IngestSummary> {
  const items = titles.map((t) => ({ title: t }));
  const resolved = await resolveAll(items);
  const matchedTitles = new Set(resolved.map((r) => r.item.title));
  const now = Date.now();

  await mutate((db) => {
    const newKeys = new Set(
      resolved.map(({ ref }) => canonicalKey({ tmdbId: ref.tmdbId, type: ref.type }))
    );

    // Drop account-sourced my-list entries no longer present on Netflix.
    for (const [key, entry] of Object.entries(db.userState)) {
      if (entry.source === "netflix" && entry.status === "mylist" && !newKeys.has(key)) {
        delete db.userState[key];
      }
    }

    for (const { ref } of resolved) {
      const key = canonicalKey({ tmdbId: ref.tmdbId, type: ref.type });
      const cur = db.userState[key];
      // Don't override seen or a user's protected hide/never-again.
      if (cur && (cur.status === "seen" || isProtected(cur.status))) continue;
      db.userState[key] = {
        status: "mylist",
        source: "netflix",
        updatedAt: now,
        type: ref.type,
        title: ref.title,
        tmdbId: ref.tmdbId,
      };
    }
  });

  return {
    total: items.length,
    matched: [...matchedTitles],
    unmatched: items.map((i) => i.title).filter((t) => !matchedTitles.has(t)),
  };
}

// Mark the ingest timestamp (separate mutate so it always runs).
export async function touchIngest(): Promise<void> {
  await mutate((db) => {
    db.settings.lastIngestAt = Date.now();
  });
}
