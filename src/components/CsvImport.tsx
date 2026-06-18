"use client";

import { useState } from "react";
import { parseNetflixCsv } from "@/lib/csvParse";

const BATCH = 20;

type Phase = "idle" | "importing" | "done" | "error";

export default function CsvImport({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(0);
  const [matched, setMatched] = useState(0);
  const [unmatched, setUnmatched] = useState<string[]>([]);

  async function run() {
    if (!file) return;
    setError(null);
    setMatched(0);
    setUnmatched([]);
    setDone(0);

    let titles: string[];
    try {
      titles = parseNetflixCsv(await file.text());
    } catch {
      setError("Couldn't read that file.");
      setPhase("error");
      return;
    }
    if (titles.length === 0) {
      setError("No titles found in this CSV. Is it the Netflix viewing-activity export?");
      setPhase("error");
      return;
    }

    setTotal(titles.length);
    setPhase("importing");

    let matchedCount = 0;
    const notFound: string[] = [];
    for (let i = 0; i < titles.length; i += BATCH) {
      const batch = titles.slice(i, i + BATCH);
      try {
        const res = await fetch("/api/csv", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ titles: batch }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Import failed");
        matchedCount += data.matched || 0;
        if (Array.isArray(data.unmatched)) notFound.push(...data.unmatched);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Import failed");
        setPhase("error");
        return;
      }
      setDone(Math.min(i + BATCH, titles.length));
      setMatched(matchedCount);
      setUnmatched([...notFound]);
    }

    setPhase("done");
    onDone(); // refresh catalog once, after all batches land
  }

  const pct = total ? Math.round((done / total) * 100) : 0;
  const busy = phase === "importing";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-lg rounded-t-2xl bg-panel p-5 ring-1 ring-edge sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Import Netflix history (CSV)</h2>
          <button className="text-muted hover:text-white" onClick={onClose} disabled={busy}>
            ✕
          </button>
        </div>

        <p className="mb-4 text-sm text-muted">
          On Netflix (desktop browser): <b>Account → Profile → Viewing activity → Download all</b>.
          Upload that CSV to mark everything you&apos;ve watched (TV/phone included) as seen — they
          drop out of your catalog.
        </p>

        {phase === "idle" || phase === "error" ? (
          <>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="field mb-4 file:mr-3 file:rounded file:border-0 file:bg-edge file:px-3 file:py-1 file:text-white"
            />
            {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={onClose}>
                Cancel
              </button>
              <button className="btn-primary" onClick={run} disabled={!file}>
                Import
              </button>
            </div>
          </>
        ) : (
          <div className="text-sm">
            <div className="mb-2 flex justify-between text-xs text-muted">
              <span>
                {busy ? "Matching against TMDB…" : "Done"} {done}/{total}
              </span>
              <span className="text-green-400">{matched} matched</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-edge">
              <div
                className="h-full bg-brand transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>

            {phase === "done" && (
              <p className="mt-3">
                Imported <b>{total}</b> titles — <b className="text-green-400">{matched}</b> marked
                seen, <b className="text-muted">{unmatched.length}</b> couldn&apos;t be matched.
              </p>
            )}
            {phase === "done" && unmatched.length > 0 && (
              <details className="mt-2 text-muted">
                <summary className="cursor-pointer">Unmatched titles ({unmatched.length})</summary>
                <ul className="mt-1 max-h-40 list-disc overflow-auto pl-5">
                  {unmatched.map((t, i) => (
                    <li key={`${t}-${i}`}>{t}</li>
                  ))}
                </ul>
              </details>
            )}

            <div className="mt-4 flex justify-end">
              <button className="btn-primary" onClick={onClose} disabled={busy}>
                {busy ? "Importing…" : "Done"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
