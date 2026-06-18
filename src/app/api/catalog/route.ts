import { NextRequest, NextResponse } from "next/server";
import { buildCatalog, type CatalogQuery } from "@/lib/catalog";
import { configStatus } from "@/lib/settings";
import type { MediaType } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseTypes(v: string | null): MediaType[] {
  if (!v || v === "all") return ["movie", "tv"];
  if (v === "movie") return ["movie"];
  if (v === "tv") return ["tv"];
  return ["movie", "tv"];
}

export async function GET(req: NextRequest) {
  const cfg = configStatus();
  if (!cfg.hasTmdb) {
    return NextResponse.json(
      { error: "TMDB API key not configured. Add it in Setup.", config: cfg },
      { status: 400 }
    );
  }
  const sp = req.nextUrl.searchParams;
  const query: CatalogQuery = {
    types: parseTypes(sp.get("type")),
    pages: Math.min(Math.max(Number(sp.get("pages")) || 1, 1), 5),
    showSeen: sp.get("showSeen") === "1",
    showDropped: sp.get("showDropped") === "1",
    mylistOnly: sp.get("mylistOnly") === "1",
    search: sp.get("q") || undefined,
    sort: sp.get("sort") === "popularity" ? "popularity" : "imdb",
    minImdb: sp.get("minImdb") ? Number(sp.get("minImdb")) : undefined,
  };

  try {
    const items = await buildCatalog(query);
    return NextResponse.json({ items, count: items.length, config: cfg });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to build catalog" },
      { status: 502 }
    );
  }
}
