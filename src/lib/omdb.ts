import { jsonFetch } from "./http";
import { getSettings } from "./db";

// OMDb gives the real IMDb rating by imdb id. Free tier: ~1000 req/day,
// so callers cache results in the titles store.
const API = "https://www.omdbapi.com";

export async function getImdbRating(imdbId: string): Promise<number | undefined> {
  const apikey = getSettings().omdbApiKey;
  if (!apikey || !imdbId) return undefined;
  try {
    const data = await jsonFetch<{ imdbRating?: string; Response?: string }>(
      `${API}/?apikey=${apikey}&i=${encodeURIComponent(imdbId)}`
    );
    if (data.Response === "False") return undefined;
    const n = data.imdbRating ? Number(data.imdbRating) : NaN;
    return Number.isFinite(n) ? n : undefined;
  } catch {
    return undefined;
  }
}
