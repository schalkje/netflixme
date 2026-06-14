"use client";

import { useState } from "react";

interface BackfillResult {
  total: number;
  matched: string[];
  unmatched: string[];
  pushedToSimkl: boolean;
}

export default function CsvImport({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BackfillResult | null>(null);

  async function run() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/csv", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      setResult(data as BackfillResult);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-lg rounded-t-2xl bg-panel p-5 ring-1 ring-edge sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Import Netflix history (CSV)</h2>
          <button className="text-muted hover:text-white" onClick={onClose}>
            ✕
          </button>
        </div>

        <p className="mb-4 text-sm text-muted">
          On Netflix (desktop browser): <b>Account → Profile → Viewing activity → Download all</b>.
          Upload that CSV here to mark everything you&apos;ve watched on TV/phone as seen — they then
          drop out of your catalog. Matched titles are also pushed to Simkl when connected.
        </p>

        {!result ? (
          <>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="field mb-4 file:mr-3 file:rounded file:border-0 file:bg-edge file:px-3 file:py-1 file:text-white"
            />
            {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={onClose} disabled={busy}>
                Cancel
              </button>
              <button className="btn-primary" onClick={run} disabled={!file || busy}>
                {busy ? "Importing…" : "Import"}
              </button>
            </div>
          </>
        ) : (
          <div className="text-sm">
            <p className="mb-2">
              Parsed <b>{result.total}</b> unique titles. Matched{" "}
              <b className="text-green-400">{result.matched.length}</b>, couldn&apos;t match{" "}
              <b className="text-muted">{result.unmatched.length}</b>.
              {result.pushedToSimkl
                ? " Pushed to Simkl."
                : " (Connect Simkl to also push these.)"}
            </p>
            {result.unmatched.length > 0 && (
              <details className="mt-2 text-muted">
                <summary className="cursor-pointer">Unmatched titles</summary>
                <ul className="mt-1 max-h-40 list-disc overflow-auto pl-5">
                  {result.unmatched.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </details>
            )}
            <div className="mt-4 flex justify-end">
              <button className="btn-primary" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
