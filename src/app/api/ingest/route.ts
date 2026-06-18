import { NextRequest, NextResponse } from "next/server";
import { ingestHistory, ingestMyList, touchIngest, type HistoryEntry } from "@/lib/ingest";
import { verifyIngestToken, configStatus } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-netflixme-token",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS });
}

// Receives Netflix account data from the browser extension.
// Body: { history?: (string | {title, netflixId?})[], myList?: string[] }
export async function POST(req: NextRequest) {
  if (!verifyIngestToken(req.headers.get("x-netflixme-token"))) {
    return json({ error: "invalid or missing ingest token" }, 401);
  }
  if (!configStatus().hasTmdb) {
    return json({ error: "TMDB API key not configured (needed to match titles)" }, 400);
  }

  const body = (await req.json().catch(() => ({}))) as {
    history?: (string | HistoryEntry)[];
    myList?: string[];
  };

  const hasHistory = Array.isArray(body.history) && body.history.length > 0;
  const hasMyList = Array.isArray(body.myList) && body.myList.length > 0;
  if (!hasHistory && !hasMyList) {
    return json({ error: "nothing to ingest" }, 400);
  }

  try {
    const history = hasHistory ? await ingestHistory(body.history!, "netflix") : null;
    const myList = hasMyList ? await ingestMyList(body.myList!) : null;
    await touchIngest();
    return json({
      ok: true,
      history: history && { matched: history.matched.length, unmatched: history.unmatched.length },
      myList: myList && { matched: myList.matched.length, unmatched: myList.unmatched.length },
      config: configStatus(),
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "ingest failed" }, 502);
  }
}
