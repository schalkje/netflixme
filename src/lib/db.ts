import fs from "node:fs";
import path from "node:path";
import type { DbShape, Settings } from "./types";

// ---------------------------------------------------------------------------
// Local-first JSON store.
//
// The plan called for SQLite; we use a single JSON file instead to stay
// zero-setup and dependency-free (no native build on Windows/Node 24). The
// access surface below is deliberately small so this could be swapped for a
// real DB later without touching callers. Data lives in ./.data/db.json which
// is gitignored (it holds your tokens + cached catalog).
// ---------------------------------------------------------------------------

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "db.json");

const DEFAULT_SETTINGS: Settings = {
  region: process.env.NEXT_PUBLIC_WATCH_REGION || "US",
};

function emptyDb(): DbShape {
  return { settings: { ...DEFAULT_SETTINGS }, titles: {}, userState: {}, version: 1 };
}

// Layer env-provided keys on top of stored settings so either source works.
function withEnvDefaults(s: Settings): Settings {
  return {
    ...s,
    region: s.region || process.env.NEXT_PUBLIC_WATCH_REGION || "US",
    tmdbApiKey: s.tmdbApiKey || process.env.TMDB_API_KEY || undefined,
    omdbApiKey: s.omdbApiKey || process.env.OMDB_API_KEY || undefined,
  };
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readRaw(): DbShape {
  try {
    const txt = fs.readFileSync(DB_FILE, "utf8");
    const parsed = JSON.parse(txt) as DbShape;
    return {
      version: parsed.version ?? 1,
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
      titles: parsed.titles || {},
      userState: parsed.userState || {},
    };
  } catch {
    return emptyDb();
  }
}

function writeRaw(db: DbShape) {
  ensureDir();
  const tmp = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), "utf8");
  fs.renameSync(tmp, DB_FILE); // atomic on same volume
}

// Serialize writes within this process to avoid lost updates under concurrency.
let chain: Promise<unknown> = Promise.resolve();

export function readDb(): DbShape {
  return readRaw();
}

export function getSettings(): Settings {
  return withEnvDefaults(readRaw().settings);
}

export async function mutate<T>(fn: (db: DbShape) => T): Promise<T> {
  const run = chain.then(() => {
    const db = readRaw();
    const result = fn(db);
    writeRaw(db);
    return result;
  });
  // keep the chain alive even if this mutation throws
  chain = run.catch(() => undefined);
  return run;
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  return mutate((db) => {
    db.settings = { ...db.settings, ...patch };
    return withEnvDefaults(db.settings);
  });
}
