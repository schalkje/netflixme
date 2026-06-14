import type { MediaType, UserStateRecord } from "./types";

// A canonical key so Simkl-sourced state and TMDB-sourced catalog items line up.
// Prefer imdb (shared across both), then tmdb, then simkl.
export function canonicalKey(args: {
  imdbId?: string;
  tmdbId?: number;
  type?: MediaType;
  simklId?: number;
}): string {
  if (args.imdbId) return args.imdbId;
  if (args.tmdbId != null && args.type) return `tmdb:${args.type}:${args.tmdbId}`;
  if (args.simklId != null) return `simkl:${args.simklId}`;
  return `unknown:${Math.random().toString(36).slice(2)}`;
}

// Build fast lookup maps from userState so a catalog item can match by either id.
export function buildStateIndex(userState: Record<string, UserStateRecord>) {
  const byImdb = new Map<string, UserStateRecord>();
  const byTmdb = new Map<string, UserStateRecord>();
  for (const entry of Object.values(userState)) {
    if (entry.imdbId) byImdb.set(entry.imdbId, entry);
    if (entry.tmdbId != null && entry.type) {
      byTmdb.set(`${entry.type}:${entry.tmdbId}`, entry);
    }
  }
  return {
    lookup(imdbId?: string, tmdbId?: number, type?: MediaType): UserStateRecord | null {
      if (imdbId && byImdb.has(imdbId)) return byImdb.get(imdbId)!;
      if (tmdbId != null && type) {
        const hit = byTmdb.get(`${type}:${tmdbId}`);
        if (hit) return hit;
      }
      return null;
    },
  };
}
