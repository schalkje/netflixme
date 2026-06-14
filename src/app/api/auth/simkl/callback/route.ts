import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken } from "@/lib/simkl";
import { setSimklTokens } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Simkl redirects back here with ?code & ?state.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expected = req.cookies.get("simkl_oauth_state")?.value;

  const fail = (msg: string) =>
    NextResponse.redirect(new URL(`/setup?error=${encodeURIComponent(msg)}`, req.url));

  if (!code) return fail("Simkl did not return an authorization code");
  if (!state || !expected || state !== expected) return fail("OAuth state mismatch");

  try {
    const token = await exchangeCodeForToken(code);
    await setSimklTokens({ accessToken: token, obtainedAt: Date.now() });
  } catch {
    return fail("Failed to exchange Simkl authorization code");
  }

  const res = NextResponse.redirect(new URL("/?connected=1", req.url));
  res.cookies.delete("simkl_oauth_state");
  return res;
}
