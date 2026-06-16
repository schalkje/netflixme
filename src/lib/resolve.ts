import { searchTitle } from "./tmdb";
import type { MediaType } from "./types";

export interface TitleRef {
  tmdbId: number;
  type: MediaType;
  title: string;
}

// Module-level resolution cache (query string -> match|null). Persists for the
// dev-server lifetime so repeated show prefixes (e.g. every "Person of Interest:
// <episode>") only hit TMDB once.
const cache = new Map<string, TitleRef | null>();
const CACHE_CAP = 8000;

// Netflix names episodes "Show: Episode" (often with no Season/Episode marker),
// and sometimes "Show: Subtitle: Episode". But real titles can also contain a
// colon ("Mission: Impossible", "Star Trek: Voyager", "Queen Charlotte: A
// Bridgerton Story"). So we try the title at progressively shorter colon-prefixes
// and accept the first (most specific) that TMDB knows.
function prefixCandidates(raw: string): string[] {
  const parts = raw
    .split(":")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length <= 1) return [raw.trim()];
  // For 3+ segments the full string is almost always Show: …: Episode, so skip it
  // and start one segment in; for 2 segments keep the full (catches Mission:
  // Impossible) then fall back to the first segment.
  const maxLen = parts.length <= 2 ? parts.length : parts.length - 1;
  const out: string[] = [];
  for (let len = maxLen; len >= 1; len--) out.push(parts.slice(0, len).join(": "));
  return [...new Set(out)];
}

async function lookup(query: string): Promise<TitleRef | null> {
  if (cache.has(query)) return cache.get(query)!;
  const r = await searchTitle(query);
  const ref = r ? { tmdbId: r.tmdbId, type: r.type, title: r.title } : null;
  if (cache.size > CACHE_CAP) cache.clear();
  cache.set(query, ref);
  return ref;
}

// Resolve a free-text title (Netflix history / My List / CSV) to a TMDB title,
// trying colon-prefixes so episode rows collapse onto their show.
export async function resolveTitle(raw: string): Promise<TitleRef | null> {
  for (const candidate of prefixCandidates(raw)) {
    const ref = await lookup(candidate);
    if (ref) return ref;
  }
  return null;
}
