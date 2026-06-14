"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface SettingsView {
  region: string;
  hasSimklClientId: boolean;
  hasSimklClientSecret: boolean;
  hasTmdb: boolean;
  hasOmdb: boolean;
  config: { simklConnected: boolean };
}

function Status({ ok }: { ok: boolean }) {
  return (
    <span className={ok ? "text-green-400" : "text-muted"}>
      {ok ? "✓ set" : "— not set"}
    </span>
  );
}

export default function SetupForm() {
  const [view, setView] = useState<SettingsView | null>(null);
  const [region, setRegion] = useState("");
  const [fields, setFields] = useState({
    simklClientId: "",
    simklClientSecret: "",
    tmdbApiKey: "",
    omdbApiKey: "",
  });
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
      setFields({ simklClientId: "", simklClientSecret: "", tmdbApiKey: "", omdbApiKey: "" });
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
        Keys are stored locally in <code>./.data</code> (gitignored) and are only used server-side.
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
            <h2 className="font-semibold">Simkl (your lists + watched)</h2>
            <Status ok={!!view?.hasSimklClientId && !!view?.hasSimklClientSecret} />
          </div>
          <p className="mb-2 text-xs text-muted">
            Create an app at simkl.com/settings/developer. Set its redirect URI to{" "}
            <code>http://localhost:3000/api/auth/simkl/callback</code>.
          </p>
          <div className="flex flex-col gap-2">
            <input className="field" placeholder="Simkl Client ID" value={fields.simklClientId} onChange={set("simklClientId")} />
            <input className="field" placeholder="Simkl Client Secret" type="password" value={fields.simklClientSecret} onChange={set("simklClientSecret")} />
          </div>
          <div className="mt-3 text-xs">
            {view?.config.simklConnected ? (
              <span className="text-green-400">✓ Connected — authorize again from the home page if needed.</span>
            ) : view?.hasSimklClientId && view?.hasSimklClientSecret ? (
              <a className="text-brand underline" href="/api/auth/simkl">
                Connect Simkl now →
              </a>
            ) : (
              <span className="text-muted">Save your client id/secret first, then connect.</span>
            )}
          </div>
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
    </main>
  );
}
