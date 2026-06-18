// Pure CSV parsing — no server imports, so it can run in the browser too.

// Parse one CSV line, honoring double-quoted fields (Netflix quotes titles that
// contain commas).
export function parseCsvLine(line: string): string[] {
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

// Season/episode markers across the languages Netflix localizes titles into, so
// "Breaking Bad: Seizoen 4: Shotgun" -> "Breaking Bad" and
// "Teach You a Lesson: Miniserie: Aflevering 1" -> "Teach You a Lesson", while
// "Mission: Impossible" (no marker) is kept intact.
const EPISODE_MARKER =
  /^(season|seizoen|saison|staffel|temporada|stagione|sezon|sezona|seria|series|serie|miniserie|mini-?series|limited series|episode|aflevering|épisode|folge|episodio|odcinek|chapter|hoofdstuk|chapitre|kapitel|cap[ií]tulo|part|deel|partie|teil|parte|volume|book|boek)\b/i;

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
