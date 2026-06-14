import { NextRequest, NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/db";
import { configStatus, getOrCreateIngestToken } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Returns presence flags + region, plus the ingest token & backend URL the
// browser extension needs (this is a local, single-user app).
export async function GET(req: NextRequest) {
  const s = getSettings();
  const token = await getOrCreateIngestToken();
  const backendUrl = process.env.APP_BASE_URL || req.nextUrl.origin;
  return NextResponse.json({
    region: s.region,
    hasTmdb: Boolean(s.tmdbApiKey),
    hasOmdb: Boolean(s.omdbApiKey),
    ingestToken: token,
    backendUrl,
    config: configStatus(),
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, string> = {};
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  if (typeof body.region === "string" && body.region.trim()) {
    patch.region = body.region.trim().toUpperCase();
  }
  for (const field of ["tmdbApiKey", "omdbApiKey"] as const) {
    const v = str(body[field]);
    if (v) patch[field] = v;
  }

  await updateSettings(patch);
  return NextResponse.json({ ok: true, config: configStatus() });
}
