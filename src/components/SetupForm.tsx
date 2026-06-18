"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface SettingsView {
  region: string;
  hasTmdb: boolean;
  hasOmdb: boolean;
  ingestToken: string;
  backendUrl: string;
}

function Status({ ok }: { ok: boolean }) {
  return <span className={ok ? "text-green-400" : "text-muted"}>{ok ? "✓ set" : "— not set"}</span>;
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mb-2">
      <label className="mb-1 block text-xs text-muted">{label}</label>
      <div className="flex gap-2">
        <input className="field font-mono text-xs" readOnly value={value} />
        <button
          type="button"
          className="btn-ghost shrink-0"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              /* ignore */
            }
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export default function SetupForm() {
  const [view, setView] = useState<SettingsView | null>(null);
  const [region, setRegion] = useState("");
  const [fields, setFields] = useState({ tmdbApiKey: "", omdbApiKey: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/settings");
    const data = (await res.json()) as SettingsView;
    setView(data);
    setRegion((r) => r || data.region);
  }

  useEffect(() => {
    load();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region, ...fields }),
      });
      if (!res.ok) throw new Error("Save failed");
      setFields({ tmdbApiKey: "", omdbApiKey: "" });
      await load();
      setMsg("Saved.");
    } catch {
      setMsg("Save failed.");
    } finally {
      setSaving(false);
    }
  }

  const set = (k: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFields((f) => ({ ...f, [k]: e.target.value }));

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Setup</h1>
        <Link href="/" className="btn-ghost">
          ← Back
        </Link>
      </div>

      <p className="mb-6 text-sm text-muted">
        Keys are stored locally in <code>./.data</code> (gitignored) and used only server-side.
        Leave a field blank to keep its existing value.
      </p>

      <form onSubmit={save} className="flex flex-col gap-5">
        <section className="rounded-lg border border-edge bg-panel/50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">TMDB (Netflix catalog)</h2>
            <Status ok={!!view?.hasTmdb} />
          </div>
          <p className="mb-2 text-xs text-muted">
            Free v3 API key from themoviedb.org/settings/api. Required.
          </p>
          <input className="field" placeholder="TMDB v3 API key" value={fields.tmdbApiKey} onChange={set("tmdbApiKey")} />
        </section>

        <section className="rounded-lg border border-edge bg-panel/50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">OMDb (IMDb scores)</h2>
            <Status ok={!!view?.hasOmdb} />
          </div>
          <p className="mb-2 text-xs text-muted">Free key from omdbapi.com/apikey.aspx.</p>
          <input className="field" placeholder="OMDb API key" value={fields.omdbApiKey} onChange={set("omdbApiKey")} />
        </section>

        <section className="rounded-lg border border-edge bg-panel/50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Region</h2>
            <span className="text-muted">{view?.region}</span>
          </div>
          <p className="mb-2 text-xs text-muted">ISO country code for the Netflix catalog (e.g. NL, US, GB).</p>
          <input
            className="field uppercase"
            placeholder="NL"
            maxLength={2}
            value={region}
            onChange={(e) => setRegion(e.target.value.toUpperCase())}
          />
        </section>

        <div className="flex items-center gap-3">
          <button className="btn-primary" disabled={saving} type="submit">
            {saving ? "Saving…" : "Save"}
          </button>
          {msg && <span className="text-sm text-muted">{msg}</span>}
        </div>
      </form>

      {/* Extension config — outside the form (read-only values to copy). */}
      <section className="mt-6 rounded-lg border border-edge bg-panel/50 p-4">
        <h2 className="mb-1 font-semibold">Read your Netflix (sync extension)</h2>
        <p className="mb-3 text-xs text-muted">
          Install the <b>netflixme sync</b> extension (the <code>extension/</code> folder, via{" "}
          <code>chrome://extensions</code> → Load unpacked). In its Options, paste these two values.
          It then reads your Netflix history + My List automatically. Or skip it and use{" "}
          <b>Import CSV</b> on the home page.
        </p>
        {view && (
          <>
            <CopyField label="netflixme URL" value={view.backendUrl} />
            <CopyField label="Ingest token" value={view.ingestToken} />
          </>
        )}
      </section>
    </main>
  );
}
