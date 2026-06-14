import { getSettings, updateSettings } from "./db";
import { decrypt, encrypt } from "./crypto";
import type { ConfigStatus, SimklTokens } from "./types";

export function configStatus(): ConfigStatus {
  const s = getSettings();
  const hasSimklClient = Boolean(s.simklClientId && s.simklClientSecret);
  const simklConnected = Boolean(s.simklTokens?.accessToken);
  const hasTmdb = Boolean(s.tmdbApiKey);
  const hasOmdb = Boolean(s.omdbApiKey);
  return {
    hasSimklClient,
    simklConnected,
    hasTmdb,
    hasOmdb,
    region: s.region,
    // Enough to render a catalog: we need TMDB (the Netflix catalog) at minimum.
    // Simkl is what makes the filtering useful, but the app still works read-only
    // without it.
    ready: hasTmdb,
    lastSyncAt: s.lastSyncAt,
    lastCatalogRefreshAt: s.lastCatalogRefreshAt,
  };
}

export async function setSimklTokens(tokens: SimklTokens | null): Promise<void> {
  if (!tokens) {
    await updateSettings({ simklTokens: null });
    return;
  }
  await updateSettings({
    simklTokens: {
      ...tokens,
      accessToken: encrypt(tokens.accessToken),
      obtainedAt: tokens.obtainedAt ?? Date.now(),
    },
  });
}

// Returns the decrypted access token, or null if not connected / undecryptable.
export function getSimklAccessToken(): string | null {
  const s = getSettings();
  const enc = s.simklTokens?.accessToken;
  if (!enc) return null;
  try {
    return decrypt(enc);
  } catch {
    return null;
  }
}
