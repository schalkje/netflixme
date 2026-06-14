// Shared domain types for netflixme.

export type MediaType = "movie" | "tv";

// A title's status in the user's world.
// - seen:   already watched (read from Netflix viewing activity, or CSV backfill)
// - mylist: on your list (read from Netflix My List, or added locally)
// - dropped:never want to see again (local)
// - hidden: locally hidden in netflixme only
export type UserStatus = "seen" | "mylist" | "dropped" | "hidden";

// Where a piece of user state came from.
// - netflix: read from your Netflix account (extension)
// - csv:     imported from a Netflix viewing-activity CSV
// - manual:  set inside netflixme
export type StateSource = "netflix" | "csv" | "manual";

export interface TitleRecord {
  key: string; // canonical key (imdb id if known, else `tmdb:<type>:<id>`)
  type: MediaType;
  title: string;
  year?: number;
  tmdbId?: number;
  imdbId?: string;
  poster?: string; // absolute URL
  overview?: string;
  imdbRating?: number; // 0-10
  tmdbRating?: number; // 0-10
  netflixId?: string; // Netflix title id, when learned from the account
  lastRefreshed: number; // epoch ms
}

export interface UserStateRecord {
  status: UserStatus;
  source: StateSource;
  updatedAt: number; // epoch ms
  type?: MediaType;
  title?: string;
  imdbId?: string;
  tmdbId?: number;
  netflixId?: string;
}

export interface Settings {
  region: string; // ISO 3166-1 alpha-2, e.g. "NL"
  tmdbApiKey?: string;
  omdbApiKey?: string;
  ingestToken?: string; // shared secret the browser extension uses to POST data
  lastIngestAt?: number;
  lastCatalogRefreshAt?: number;
}

export interface DbShape {
  settings: Settings;
  titles: Record<string, TitleRecord>;
  userState: Record<string, UserStateRecord>;
  version: number;
}

// What the catalog API returns to the client for one card.
export interface CatalogItem {
  key: string;
  type: MediaType;
  title: string;
  year?: number;
  poster?: string;
  overview?: string;
  imdbRating?: number;
  imdbId?: string;
  tmdbId?: number;
  status: UserStatus | null;
  playUrl: string;
  playIsSearch: boolean; // true when we fell back to a Netflix search deep-link
}

export interface ConfigStatus {
  hasTmdb: boolean;
  hasOmdb: boolean;
  region: string;
  ready: boolean; // enough config to show a catalog
  ingestConfigured: boolean; // an ingest token exists (extension can sync)
  lastIngestAt?: number;
  lastCatalogRefreshAt?: number;
  seenCount: number;
  mylistCount: number;
}
