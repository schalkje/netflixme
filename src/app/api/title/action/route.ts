import { NextRequest, NextResponse } from "next/server";
import { applyAction, type ActionKind } from "@/lib/actions";
import type { MediaType } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID: ActionKind[] = ["mylist", "seen", "dropped", "hidden", "remove"];

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = body.action as ActionKind;
  const type = body.type as MediaType;

  if (!VALID.includes(action)) {
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }
  if (type !== "movie" && type !== "tv") {
    return NextResponse.json({ error: "invalid type" }, { status: 400 });
  }
  if (body.imdbId == null && body.tmdbId == null) {
    return NextResponse.json({ error: "imdbId or tmdbId required" }, { status: 400 });
  }

  const result = await applyAction({
    action,
    type,
    title: typeof body.title === "string" ? body.title : "",
    imdbId: typeof body.imdbId === "string" ? body.imdbId : undefined,
    tmdbId: typeof body.tmdbId === "number" ? body.tmdbId : undefined,
  });

  return NextResponse.json({ ok: true, ...result });
}
