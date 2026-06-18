import { mutate } from "./db";
import { canonicalKey } from "./ids";
import type { MediaType, UserStateRecord, UserStatus } from "./types";

export type ActionKind = "mylist" | "seen" | "dropped" | "hidden" | "remove";

export interface ActionInput {
  action: ActionKind;
  type: MediaType;
  title: string;
  imdbId?: string;
  tmdbId?: number;
}

const STATUS_FOR: Partial<Record<ActionKind, UserStatus>> = {
  mylist: "mylist",
  seen: "seen",
  dropped: "dropped",
  hidden: "hidden",
};

// Apply an action against local state (the source of truth for the UI). The
// browser extension is what syncs back to the real Netflix account.
export async function applyAction(input: ActionInput): Promise<{ status: UserStatus | null }> {
  const key = canonicalKey({ imdbId: input.imdbId, tmdbId: input.tmdbId, type: input.type });

  return mutate((db) => {
    if (input.action === "remove") {
      delete db.userState[key];
      return { status: null };
    }
    const status = STATUS_FOR[input.action]!;
    const entry: UserStateRecord = {
      status,
      source: "manual",
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
