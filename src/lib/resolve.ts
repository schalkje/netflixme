import { searchTitle } from "./tmdb";
import type { MediaType } from "./types";

export interface TitleRef {
  tmdbId: number;
  type: MediaType;
  title: string;
}

// Resolve a free-text title (from Netflix history / My List / a CSV) to a TMDB
// title so it lines up with the catalog.
export async function resolveTitle(title: string): Promise<TitleRef | null> {
  const r = await searchTitle(title);
  if (!r) return null;
  return { tmdbId: r.tmdbId, type: r.type, title: r.title };
}
