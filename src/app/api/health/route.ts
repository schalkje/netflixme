import { NextResponse } from "next/server";
import { configStatus } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(configStatus());
}
