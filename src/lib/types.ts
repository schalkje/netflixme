// Shared domain types for netflixme.

export type MediaType = "movie" | "tv";

// A title's status in the user's world.
// - seen:   already watched (Simkl completed/history, or CSV backfill)
// - mylist: want to watch (Simkl plantowatch)
// - dropped:never want to see again (Simkl dropped)
// - hidden: locally hidden in netflixme only (finer control, not pushed to Simkl)
export type UserStatus = "seen" | "mylist" | "dropped" | "hidden";

export type StateSource = "simkl" | "csv" | "manual";

export interface TitleRecord {
  key: string; // canonical key (imdb id if known, else `tmdb:<type>:<id>`, else `simkl:<id>`)
  type: MediaType;
  title: string;
  year?: number;
  tmdbId?: number;
  imdbId?: string;
  simklId?: number;
  poster?: string; // absolute URL
  overview?: string;
  imdbRating?: number; // 0-10
  simklRating?: number; // 0-10
  netflixId?: string; // Netflix title id, when resolvable
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
  simklId?: number;
}

export interface SimklTokens {
  accessToken: string; // stored encrypted at rest
  tokenType?: string;
  scope?: string;
  obtainedAt?: number;
}

export interface Settings {
  region: string; // ISO 3166-1 alpha-2, e.g. "NL"
  simklClientId?: string;
  simklClientSecret?: string;
  tmdbApiKey?: string;
  omdbApiKey?: string;
  simklTokens?: SimklTokens | null;
  lastSyncAt?: number;
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
  status: UserStatus | null;
  playUrl: string;
  playIsSearch: boolean; // true when we fell back to a Netflix search deep-link
}

export interface ConfigStatus {
  hasSimklClient: boolean;
  simklConnected: boolean;
  hasTmdb: boolean;
  hasOmdb: boolean;
  region: string;
  ready: boolean; // enough config to show a catalog
  lastSyncAt?: number;
  lastCatalogRefreshAt?: number;
}
