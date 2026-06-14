import { NextResponse } from "next/server";
import { setSimklTokens } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  await setSimklTokens(null);
  return NextResponse.json({ ok: true });
}
