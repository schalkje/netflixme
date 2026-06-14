import { mutate } from "./db";
import { addToHistory, addToList, removeFromList, addRating, type SimklIds } from "./simkl";
import { getSimklAccessToken } from "./settings";
import { canonicalKey } from "./ids";
import type { MediaType, UserStateRecord, UserStatus } from "./types";

export type ActionKind = "mylist" | "seen" | "dropped" | "hidden" | "remove" | "rate";

export interface ActionInput {
  action: ActionKind;
  type: MediaType;
  title: string;
  imdbId?: string;
  tmdbId?: number;
  rating?: number; // for action=rate
}

function idsFor(input: ActionInput): SimklIds {
  const ids: SimklIds = {};
  if (input.imdbId) ids.imdb = input.imdbId;
  if (input.tmdbId != null) ids.tmdb = input.tmdbId;
  return ids;
}

const STATUS_FOR: Partial<Record<ActionKind, UserStatus>> = {
  mylist: "mylist",
  seen: "seen",
  dropped: "dropped",
  hidden: "hidden",
};

// Apply an action: write through to Simkl when connected, and update local state
// immediately so the UI reflects it without waiting for a re-sync.
export async function applyAction(input: ActionInput): Promise<{ status: UserStatus | null }> {
  const connected = Boolean(getSimklAccessToken());
  const ids = idsFor(input);
  const key = canonicalKey({ imdbId: input.imdbId, tmdbId: input.tmdbId, type: input.type });

  // Best-effort Simkl write (local state is the source of truth for the UI).
  if (connected) {
    try {
      switch (input.action) {
        case "mylist":
          await addToList(ids, input.type, "plantowatch");
          break;
        case "seen":
          await addToHistory(ids, input.type);
          break;
        case "dropped":
          await addToList(ids, input.type, "dropped");
          break;
        case "remove":
          await removeFromList(ids, input.type);
          break;
        case "rate":
          if (typeof input.rating === "number") await addRating(ids, input.type, input.rating);
          break;
        case "hidden":
          // local-only, nothing to push
          break;
      }
    } catch {
      /* swallow: keep local state authoritative */
    }
  }

  return mutate((db) => {
    if (input.action === "remove") {
      delete db.userState[key];
      return { status: null };
    }
    if (input.action === "rate") {
      return { status: db.userState[key]?.status ?? null };
    }
    const status = STATUS_FOR[input.action]!;
    const entry: UserStateRecord = {
      status,
      source: input.action === "hidden" ? "manual" : connected ? "simkl" : "manual",
      updatedAt: Date.now(),
      type: input.type,
      title: input.title,
      imdbId: input.imdbId,
      tmdbId: input.tmdbId,
    };
    db.userState[key] = entry;
    return { status };
  });
}
