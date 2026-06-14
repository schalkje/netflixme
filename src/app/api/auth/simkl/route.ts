import { NextResponse } from "next/server";
import { getSettings } from "@/lib/db";
import { buildAuthorizeUrl } from "@/lib/simkl";
import { randomState } from "@/lib/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Kick off the Simkl OAuth redirect flow.
export async function GET() {
  const s = getSettings();
  if (!s.simklClientId || !s.simklClientSecret) {
    return NextResponse.json(
      { error: "Simkl client id/secret not configured. Add them in Setup first." },
      { status: 400 }
    );
  }
  const state = randomState();
  const res = NextResponse.redirect(buildAuthorizeUrl(state));
  res.cookies.set("simkl_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
