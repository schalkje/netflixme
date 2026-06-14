import { mutate } from "./db";
import { getAllItems } from "./simkl";
import { canonicalKey } from "./ids";
import type { UserStateRecord } from "./types";

export interface SyncResult {
  seen: number;
  mylist: number;
  dropped: number;
  total: number;
  syncedAt: number;
}

// Pull the user's full Simkl library into userState. Simkl-sourced entries are
// rebuilt each run; locally-created entries (e.g. "hidden") that Simkl doesn't
// know about are preserved.
export async function runSync(): Promise<SyncResult> {
  const items = await getAllItems();
  const now = Date.now();

  return mutate((db) => {
    const next: Record<string, UserStateRecord> = {};

    for (const it of items) {
      const key = canonicalKey({
        imdbId: it.ids.imdb,
        tmdbId: it.ids.tmdb,
        type: it.type,
        simklId: it.ids.simkl,
      });
      next[key] = {
        status: it.status,
        source: "simkl",
        updatedAt: now,
        type: it.type,
        title: it.title,
        imdbId: it.ids.imdb,
        tmdbId: it.ids.tmdb,
        simklId: it.ids.simkl,
      };
    }

    // Preserve local-only entries Simkl doesn't represent (hidden, pending manual).
    for (const [key, entry] of Object.entries(db.userState)) {
      if (!next[key] && (entry.status === "hidden" || entry.source !== "simkl")) {
        next[key] = entry;
      }
    }

    db.userState = next;
    db.settings.lastSyncAt = now;

    const counts = { seen: 0, mylist: 0, dropped: 0 };
    for (const e of Object.values(next)) {
      if (e.status === "seen") counts.seen++;
      else if (e.status === "mylist") counts.mylist++;
      else if (e.status === "dropped") counts.dropped++;
    }
    return { ...counts, total: Object.keys(next).length, syncedAt: now };
  });
}
