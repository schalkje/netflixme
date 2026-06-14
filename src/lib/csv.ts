import { ingestHistory, touchIngest, type IngestSummary } from "./ingest";

// Parse one CSV line, honoring double-quoted fields (Netflix quotes titles that
// contain commas).
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

const EPISODE_MARKER = /^(season|episode|chapter|part|volume|book|series|limited series)\b/i;

// "Stranger Things: Season 4: Chapter One" -> "Stranger Things"
// "Mission: Impossible" -> "Mission: Impossible"  (no episode marker, kept)
export function baseTitle(raw: string): string {
  const segments = raw.split(":").map((s) => s.trim());
  const kept: string[] = [];
  for (const seg of segments) {
    if (EPISODE_MARKER.test(seg)) break;
    kept.push(seg);
  }
  return (kept.length ? kept.join(": ") : raw).trim();
}

// Extract the Title column from a Netflix viewing-activity CSV and reduce to
// unique base titles.
export function parseNetflixCsv(text: string): string[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const first = parseCsvLine(lines[0]).map((c) => c.toLowerCase().trim());
  const startIdx = first[0] === "title" ? 1 : 0;
  const titles = new Set<string>();
  for (let i = startIdx; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const raw = (cols[0] || "").trim();
    if (raw) titles.add(baseTitle(raw));
  }
  return [...titles];
}

// Resolve CSV titles and mark them seen (same pipeline the extension uses).
export async function backfillFromCsv(baseTitles: string[]): Promise<IngestSummary> {
  const result = await ingestHistory(baseTitles, "csv");
  await touchIngest();
  return result;
}
