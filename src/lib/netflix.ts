import type { TitleRecord } from "./types";

// Netflix playback handoff. TMDB does not expose Netflix title ids or deep links,
// so in practice we deep-link to a Netflix in-app search by title (one tap to
// play). If a real Netflix id ever becomes known (e.g. future enrichment), we use
// the precise /title/{id} link. Either link opens the Netflix app on mobile, which
// then handles casting to the TV.

export function netflixTitleUrl(netflixId: string): string {
  return `https://www.netflix.com/title/${encodeURIComponent(netflixId)}`;
}

export function netflixSearchUrl(title: string): string {
  return `https://www.netflix.com/search?q=${encodeURIComponent(title)}`;
}

export function buildPlayUrl(rec: Pick<TitleRecord, "netflixId" | "title">): {
  url: string;
  isSearch: boolean;
} {
  if (rec.netflixId) return { url: netflixTitleUrl(rec.netflixId), isSearch: false };
  return { url: netflixSearchUrl(rec.title), isSearch: true };
}
