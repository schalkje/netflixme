import { jsonFetch } from "./http";
import { getSettings } from "./db";
import { getSimklAccessToken } from "./settings";
import type { MediaType, UserStatus } from "./types";

// Simkl client. Docs: https://simkl.docs.apiary.io / https://api.simkl.org
const API = "https://api.simkl.com";
const WEB = "https://simkl.com";

export interface SimklIds {
  simkl?: number;
  imdb?: string;
  tmdb?: number;
}

export interface SimklSyncItem {
  type: MediaType;
  status: UserStatus;
  title: string;
  year?: number;
  ids: SimklIds;
  userRating?: number;
}

function authHeaders(): Record<string, string> {
  const s = getSettings();
  const token = getSimklAccessToken();
  const headers: Record<string, string> = {};
  if (s.simklClientId) headers["simkl-api-key"] = s.simklClientId;
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

export function redirectUri(): string {
  const base = process.env.APP_BASE_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/auth/simkl/callback`;
}

export function buildAuthorizeUrl(state: string): string {
  const s = getSettings();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: s.simklClientId || "",
    redirect_uri: redirectUri(),
    state,
  });
  return `${WEB}/oauth/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string): Promise<string> {
  const s = getSettings();
  const res = await jsonFetch<{ access_token: string; token_type?: string; scope?: string }>(
    `${API}/oauth/token`,
    {
      method: "POST",
      body: {
        code,
        client_id: s.simklClientId,
        client_secret: s.simklClientSecret,
        redirect_uri: redirectUri(),
        grant_type: "authorization_code",
      },
    }
  );
  if (!res.access_token) throw new Error("Simkl token exchange returned no access_token");
  return res.access_token;
}

// Map Simkl list status -> our UserStatus.
function mapStatus(simklStatus: string): UserStatus | null {
  switch (simklStatus) {
    case "completed":
    case "watching":
      return "seen";
    case "plantowatch":
    case "hold":
      return "mylist";
    case "dropped":
    case "notinteresting":
      return "dropped";
    default:
      return null;
  }
}

interface RawNode {
  title?: string;
  year?: number;
  ids?: { simkl?: number; imdb?: string; tmdb?: number | string };
}
interface RawItem {
  status?: string;
  user_rating?: number;
  movie?: RawNode;
  show?: RawNode;
}

function normalize(item: RawItem, type: MediaType): SimklSyncItem | null {
  const node = item.movie || item.show;
  if (!node) return null;
  const status = mapStatus(item.status || "");
  if (!status) return null;
  const tmdb = node.ids?.tmdb;
  return {
    type,
    status,
    title: node.title || "",
    year: node.year,
    userRating: item.user_rating,
    ids: {
      simkl: node.ids?.simkl,
      imdb: node.ids?.imdb,
      tmdb: tmdb != null ? Number(tmdb) : undefined,
    },
  };
}

// Pull the user's entire library (all statuses, movies + shows) in one call.
export async function getAllItems(): Promise<SimklSyncItem[]> {
  const data = await jsonFetch<{ movies?: RawItem[]; shows?: RawItem[] }>(
    `${API}/sync/all-items/`,
    { headers: authHeaders(), timeoutMs: 30000 }
  );
  const out: SimklSyncItem[] = [];
  for (const m of data.movies || []) {
    const n = normalize(m, "movie");
    if (n) out.push(n);
  }
  for (const sh of data.shows || []) {
    const n = normalize(sh, "tv");
    if (n) out.push(n);
  }
  return out;
}

export async function getActivities(): Promise<unknown> {
  return jsonFetch(`${API}/sync/activities`, { headers: authHeaders() });
}

function payloadFor(items: SimklIds[], type: MediaType, extra: Record<string, unknown> = {}) {
  const nodes = items.map((ids) => ({ ids, ...extra }));
  return type === "movie" ? { movies: nodes } : { shows: nodes };
}

// Mark watched (used by "mark seen" + CSV backfill).
export async function addToHistory(ids: SimklIds, type: MediaType): Promise<void> {
  await jsonFetch(`${API}/sync/history`, {
    method: "POST",
    headers: authHeaders(),
    body: payloadFor([ids], type),
  });
}

// Move into a list bucket: plantowatch ("my list") or dropped ("never again").
export async function addToList(
  ids: SimklIds,
  type: MediaType,
  to: "plantowatch" | "dropped" | "completed" | "watching" | "hold"
): Promise<void> {
  await jsonFetch(`${API}/sync/add-to-list`, {
    method: "POST",
    headers: authHeaders(),
    body: payloadFor([ids], type, { to }),
  });
}

export async function removeFromList(ids: SimklIds, type: MediaType): Promise<void> {
  await jsonFetch(`${API}/sync/remove-from-list`, {
    method: "POST",
    headers: authHeaders(),
    body: payloadFor([ids], type),
  });
}

export async function addRating(ids: SimklIds, type: MediaType, rating: number): Promise<void> {
  await jsonFetch(`${API}/sync/ratings`, {
    method: "POST",
    headers: authHeaders(),
    body: payloadFor([ids], type, { rating }),
  });
}
