import { NextResponse } from "next/server";
import { runSync } from "@/lib/sync";
import { getSimklAccessToken, configStatus } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(configStatus());
}

// Pull the full Simkl library into local state.
export async function POST() {
  if (!getSimklAccessToken()) {
    return NextResponse.json({ error: "Simkl is not connected." }, { status: 400 });
  }
  try {
    const result = await runSync();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sync failed" },
      { status: 502 }
    );
  }
}
