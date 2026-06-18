import { readDb, getSettings, mutate } from "./db";
import { discoverNetflix, getImdbId, type TmdbTitle } from "./tmdb";
import { getImdbRating } from "./omdb";
import { buildStateIndex } from "./ids";
import { buildPlayUrl } from "./netflix";
import { mapLimit } from "./concurrency";
import type { CatalogItem, MediaType, TitleRecord } from "./types";

const ENRICH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // re-fetch imdb id/rating weekly
const ENRICH_CONCURRENCY = 8;

export interface CatalogQuery {
  types: MediaType[];
  pages: number;
  showSeen: boolean;
  showDropped: boolean;
  mylistOnly: boolean;
  search?: string;
  sort: "imdb" | "popularity";
  minImdb?: number;
}

function cacheKey(type: MediaType, tmdbId: number): string {
  return `tmdb:${type}:${tmdbId}`;
}

async function discoverAll(types: MediaType[], region: string, pages: number): Promise<TmdbTitle[]> {
  const jobs: { type: MediaType; page: number }[] = [];
  for (const type of types) {
    for (let p = 1; p <= pages; p++) jobs.push({ type, page: p });
  }
  const pageResults = await mapLimit(jobs, 4, async (j) => {
    try {
      return (await discoverNetflix(j.type, region, j.page)).items;
    } catch {
      return [] as TmdbTitle[];
    }
  });
  return pageResults.flat();
}

// Ensure each discovered title has a cached record with imdb id + imdb rating.
async function enrich(titles: TmdbTitle[]): Promise<Record<string, TitleRecord>> {
  const db = readDb();
  const now = Date.now();

  const records = await mapLimit(titles, ENRICH_CONCURRENCY, async (t) => {
    const key = cacheKey(t.type, t.tmdbId);
    const cached = db.titles[key];
    if (cached && now - cached.lastRefreshed < ENRICH_TTL_MS) {
      // refresh volatile catalog fields (poster/title) but keep imdb data
      return { ...cached, title: t.title, poster: t.poster ?? cached.poster };
    }
    const imdbId = await getImdbId(t.tmdbId, t.type);
    const imdbRating = imdbId ? await getImdbRating(imdbId) : undefined;
    const rec: TitleRecord = {
      key,
      type: t.type,
      title: t.title,
      year: t.year,
      tmdbId: t.tmdbId,
      imdbId,
      poster: t.poster,
      overview: t.overview,
      imdbRating,
      tmdbRating: t.tmdbRating,
      netflixId: cached?.netflixId,
      lastRefreshed: now,
    };
    return rec;
  });

  const map: Record<string, TitleRecord> = {};
  for (const r of records) map[r.key] = r;

  // Persist the refreshed cache + timestamp.
  await mutate((d) => {
    d.titles = { ...d.titles, ...map };
    d.settings.lastCatalogRefreshAt = now;
  });

  return map;
}

export async function buildCatalog(query: CatalogQuery): Promise<CatalogItem[]> {
  const settings = getSettings();
  const region = settings.region || "US";

  const discovered = await discoverAll(query.types, region, query.pages);

  // De-dup by tmdb id+type (a title can appear across pages).
  const seen = new Set<string>();
  const unique = discovered.filter((t) => {
    const k = cacheKey(t.type, t.tmdbId);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const records = await enrich(unique);

  const db = readDb();
  const index = buildStateIndex(db.userState);

  let items: CatalogItem[] = Object.values(records).map((rec) => {
    const state = index.lookup(rec.imdbId, rec.tmdbId, rec.type);
    const play = buildPlayUrl(rec);
    return {
      key: rec.key,
      type: rec.type,
      title: rec.title,
      year: rec.year,
      poster: rec.poster,
      overview: rec.overview,
      imdbRating: rec.imdbRating,
      imdbId: rec.imdbId,
      tmdbId: rec.tmdbId,
      status: state?.status ?? null,
      playUrl: play.url,
      playIsSearch: play.isSearch,
    };
  });

  // --- filters ---
  if (query.mylistOnly) {
    items = items.filter((i) => i.status === "mylist");
  } else {
    if (!query.showSeen) items = items.filter((i) => i.status !== "seen");
    if (!query.showDropped) {
      items = items.filter((i) => i.status !== "dropped" && i.status !== "hidden");
    }
  }
  if (query.search) {
    const q = query.search.toLowerCase();
    items = items.filter((i) => i.title.toLowerCase().includes(q));
  }
  if (typeof query.minImdb === "number") {
    items = items.filter((i) => (i.imdbRating ?? 0) >= query.minImdb!);
  }

  // --- sort ---
  if (query.sort === "imdb") {
    items.sort((a, b) => (b.imdbRating ?? -1) - (a.imdbRating ?? -1));
  }

  return items;
}
