import { NextRequest, NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/db";
import { configStatus } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Never return secret values to the client — only presence + region.
export async function GET() {
  const s = getSettings();
  return NextResponse.json({
    region: s.region,
    hasSimklClientId: Boolean(s.simklClientId),
    hasSimklClientSecret: Boolean(s.simklClientSecret),
    hasTmdb: Boolean(s.tmdbApiKey),
    hasOmdb: Boolean(s.omdbApiKey),
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
  // Only overwrite a key when a non-empty value is provided (lets the UI submit
  // blanks to leave existing keys untouched).
  for (const field of ["simklClientId", "simklClientSecret", "tmdbApiKey", "omdbApiKey"] as const) {
    const v = str(body[field]);
    if (v) patch[field] = v;
  }

  await updateSettings(patch);
  return NextResponse.json({ ok: true, config: configStatus() });
}
