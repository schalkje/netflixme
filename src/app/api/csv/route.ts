import { NextRequest, NextResponse } from "next/server";
import { parseNetflixCsv, backfillFromCsv } from "@/lib/csv";
import { configStatus } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readText(req: NextRequest): Promise<string> {
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (file && typeof file !== "string") return await file.text();
    const text = form.get("text");
    return typeof text === "string" ? text : "";
  }
  if (ct.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as { text?: string };
    return body.text || "";
  }
  return await req.text();
}

// Upload the Netflix viewing-activity CSV. ?preview=1 parses without writing.
export async function POST(req: NextRequest) {
  const cfg = configStatus();
  if (!cfg.hasTmdb) {
    return NextResponse.json(
      { error: "TMDB API key is required to match CSV titles. Add it in Setup." },
      { status: 400 }
    );
  }

  const text = await readText(req);
  const titles = parseNetflixCsv(text);
  if (titles.length === 0) {
    return NextResponse.json({ error: "No titles found in CSV." }, { status: 400 });
  }

  const preview = req.nextUrl.searchParams.get("preview") === "1";
  if (preview) {
    return NextResponse.json({ count: titles.length, sample: titles.slice(0, 25) });
  }

  try {
    const result = await backfillFromCsv(titles);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Backfill failed" },
      { status: 502 }
    );
  }
}
