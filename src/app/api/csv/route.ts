import { NextRequest, NextResponse } from "next/server";
import { parseNetflixCsv, backfillFromCsv } from "@/lib/csv";
import { configStatus } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Accepts either:
//  - JSON { titles: string[] }  → process this batch (client parses + batches for progress)
//  - multipart file / { text }  → parse server-side then process (fallback)
export async function POST(req: NextRequest) {
  const cfg = configStatus();
  if (!cfg.hasTmdb) {
    return NextResponse.json(
      { error: "TMDB API key is required to match CSV titles. Add it in Setup." },
      { status: 400 }
    );
  }

  const ct = req.headers.get("content-type") || "";
  let titles: string[] = [];

  try {
    if (ct.includes("application/json")) {
      const body = (await req.json().catch(() => ({}))) as { titles?: string[]; text?: string };
      if (Array.isArray(body.titles)) titles = body.titles;
      else if (typeof body.text === "string") titles = parseNetflixCsv(body.text);
    } else if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      const text =
        file && typeof file !== "string" ? await file.text() : String(form.get("text") || "");
      titles = parseNetflixCsv(text);
    } else {
      titles = parseNetflixCsv(await req.text());
    }
  } catch {
    return NextResponse.json({ error: "Could not read the request." }, { status: 400 });
  }

  titles = titles.map((t) => t.trim()).filter(Boolean);
  if (titles.length === 0) {
    return NextResponse.json({ error: "No titles to import." }, { status: 400 });
  }

  try {
    const result = await backfillFromCsv(titles);
    return NextResponse.json({
      ok: true,
      total: result.total,
      matched: result.matched.length,
      unmatched: result.unmatched,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Import failed" },
      { status: 502 }
    );
  }
}
