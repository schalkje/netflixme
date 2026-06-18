import crypto from "node:crypto";
import { readDb, getSettings, updateSettings } from "./db";
import type { ConfigStatus } from "./types";

function counts() {
  const us = readDb().userState;
  let seen = 0;
  let mylist = 0;
  for (const e of Object.values(us)) {
    if (e.status === "seen") seen++;
    else if (e.status === "mylist") mylist++;
  }
  return { seen, mylist };
}

export function configStatus(): ConfigStatus {
  const s = getSettings();
  const c = counts();
  return {
    hasTmdb: Boolean(s.tmdbApiKey),
    hasOmdb: Boolean(s.omdbApiKey),
    region: s.region,
    // We need TMDB (the Netflix catalog) at minimum to render anything.
    ready: Boolean(s.tmdbApiKey),
    ingestConfigured: Boolean(s.ingestToken),
    lastIngestAt: s.lastIngestAt,
    lastCatalogRefreshAt: s.lastCatalogRefreshAt,
    seenCount: c.seen,
    mylistCount: c.mylist,
  };
}

// The token the browser extension presents when POSTing to /api/ingest.
// Generated once and reused; safe to display in the local Setup screen.
export async function getOrCreateIngestToken(): Promise<string> {
  const existing = getSettings().ingestToken;
  if (existing) return existing;
  const token = crypto.randomBytes(24).toString("hex");
  await updateSettings({ ingestToken: token });
  return token;
}

export function verifyIngestToken(presented: string | null): boolean {
  const token = getSettings().ingestToken;
  if (!token || !presented) return false;
  // constant-time compare
  const a = Buffer.from(token);
  const b = Buffer.from(presented);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
