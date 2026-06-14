import { jsonFetch } from "./http";
import { getSettings } from "./db";
import type { MediaType } from "./types";

// TMDB v3. Netflix provider id is 8. Watch-provider data is JustWatch-sourced.
const API = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p/w500";
const NETFLIX_PROVIDER_ID = 8;

export interface TmdbTitle {
  tmdbId: number;
  type: MediaType;
  title: string;
  year?: number;
  poster?: string;
  overview?: string;
  tmdbRating?: number;
}

function key(): string {
  const k = getSettings().tmdbApiKey;
  if (!k) throw new Error("TMDB API key not configured");
  return k;
}

function posterUrl(path?: string | null): string | undefined {
  return path ? `${IMG}${path}` : undefined;
}

interface DiscoverResult {
  id: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  overview?: string;
  vote_average?: number;
}

function toTitle(r: DiscoverResult, type: MediaType): TmdbTitle {
  const date = r.release_date || r.first_air_date;
  return {
    tmdbId: r.id,
    type,
    title: r.title || r.name || "",
    year: date ? Number(date.slice(0, 4)) || undefined : undefined,
    poster: posterUrl(r.poster_path),
    overview: r.overview,
    tmdbRating: r.vote_average,
  };
}

// One page of Netflix titles for a region.
export async function discoverNetflix(
  type: MediaType,
  region: string,
  page: number
): Promise<{ items: TmdbTitle[]; totalPages: number }> {
  const path = type === "movie" ? "discover/movie" : "discover/tv";
  const params = new URLSearchParams({
    api_key: key(),
    with_watch_providers: String(NETFLIX_PROVIDER_ID),
    watch_region: region,
    sort_by: "popularity.desc",
    page: String(page),
    include_adult: "false",
  });
  const data = await jsonFetch<{ results: DiscoverResult[]; total_pages: number }>(
    `${API}/${path}?${params.toString()}`
  );
  return {
    items: (data.results || []).map((r) => toTitle(r, type)),
    totalPages: data.total_pages || 1,
  };
}

// imdb id for a TMDB title (cached by callers).
export async function getImdbId(tmdbId: number, type: MediaType): Promise<string | undefined> {
  const path = type === "movie" ? `movie/${tmdbId}/external_ids` : `tv/${tmdbId}/external_ids`;
  try {
    const data = await jsonFetch<{ imdb_id?: string }>(
      `${API}/${path}?api_key=${key()}`
    );
    return data.imdb_id || undefined;
  } catch {
    return undefined;
  }
}

// Resolve a free-text title (from the Netflix CSV) to a TMDB title.
export async function searchTitle(query: string): Promise<TmdbTitle | null> {
  const params = new URLSearchParams({
    api_key: key(),
    query,
    include_adult: "false",
  });
  try {
    const data = await jsonFetch<{
      results: (DiscoverResult & { media_type?: string })[];
    }>(`${API}/search/multi?${params.toString()}`);
    const hit = (data.results || []).find(
      (r) => r.media_type === "movie" || r.media_type === "tv"
    );
    if (!hit) return null;
    return toTitle(hit, hit.media_type === "tv" ? "tv" : "movie");
  } catch {
    return null;
  }
}
