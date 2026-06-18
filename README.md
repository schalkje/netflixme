# netflixme

A better Netflix UI that:

- **filters out whatever you've seen**
- **filters out whatever you don't want to see again**
- **manages your "my list"**
- **looks up the IMDb scores** of movies and series

Runs as an installable **web app (PWA)** on mobile and desktop. Browse on your
phone, tap **Play**, and Netflix's own app takes over — including casting to your TV.

---

## How it works

Netflix **has no public API** (shut down in 2014) and its video is **DRM-locked**, so
no app can play Netflix in a custom player — every comparable product deep-links into
the official Netflix app to play. netflixme does the same, and reads your account the
only way that actually works: a small **companion browser extension** that reuses your
own logged-in Netflix session.

| Need | Source |
| --- | --- |
| What's on Netflix (your region) | **TMDB** watch-providers (JustWatch data) |
| IMDb scores | **OMDb** |
| What you've seen + your My List | **`netflixme sync` extension** reads your Netflix account (account-wide, incl. TV/phone) |
| Zero-setup fallback for "seen" | **Netflix viewing-activity CSV** import |
| Never-again / hide | local, in netflixme |
| Playback | deep-link to the **official Netflix app** (casts to TV) |

```
Browser (phone + desktop) ── Next.js API routes ── local JSON store (./.data)
        │                          │                       │
   sync extension          TMDB catalog + OMDb IMDb   deep-link netflix.com
   reads Netflix → /api/ingest   (what's on Netflix)   (exact title once known,
   (history + My List)                                  else title search) → TV
```

Because Netflix records viewing **server-side**, the extension's read captures what you
watched on your **TV and phone** too — not just in the browser.

## Requirements

- Node.js 18+ (developed on Node 24)
- Free API keys (entered in the in-app **Setup** screen or `.env.local`):
  - **TMDB** — <https://www.themoviedb.org/settings/api> — a **v3 API key _or_ a v4
    read access token** both work *(required: the catalog)*
  - **OMDb** — <https://www.omdbapi.com/apikey.aspx> *(IMDb scores)*

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
```

1. Open the app → **Setup**. Enter your TMDB key (minimum) + OMDb + your region (e.g. `NL`).
2. Browse: the Netflix catalog for your region, sorted by IMDb, with filters.
3. **Read your Netflix account:** install the companion extension (next section) — or just
   use **Import CSV** for a one-off backfill.

### Read your Netflix account (the sync extension)

The `extension/` folder is an unpacked browser extension (Chrome/Edge/Brave, desktop):

1. `chrome://extensions` → enable **Developer mode** → **Load unpacked** → pick `extension/`.
2. Extension → **Options** → paste the **netflixme URL** and **ingest token** shown in
   netflixme's **Setup** screen → **Save**.
3. Open <https://www.netflix.com> (logged in) → click the extension → **Sync now**.

It then auto-syncs your viewing history + My List when you visit Netflix. See
`extension/README.md` for details. It's read-only and uses your own session (never your
password), but it relies on Netflix's internal API — unofficial, against Netflix's ToS,
and may break when Netflix changes things. The CSV import is the zero-risk fallback.

### Import CSV (fallback, no extension)

On Netflix (desktop): *Account → Profile → Viewing activity → Download all*, then
**Import CSV** in netflixme. Same account-wide data, just manual.

### Install on your phone

Open the dev/deployed URL on your phone (same network, or via Tailscale) → **Add to Home
Screen**. Tapping **Play** opens the Netflix app, from which you can cast to your TV.

## Usage

- **Filters:** All / Movies / Series, Top-IMDb / Popular, min-IMDb, search, *Showing seen*
  and *My List only*. Seen + never-again are hidden by default.
- **Per title:** Play, + My List, ✓ Seen, ✕ Never again, ⨯ Hide (stored locally; the
  extension is what syncs your real Netflix account in).

## Project layout

```
src/lib/        db (JSON store), settings, tmdb (v3/v4), omdb, resolve, ingest,
                catalog, csv, actions, ids, netflix deep-links
src/app/api/    health, settings, catalog, title/action, csv, ingest
src/app/        page (catalog), setup
src/components/ CatalogApp, FilterBar, TitleCard, CsvImport, SetupForm
extension/      MV3 sync extension (reads Netflix → /api/ingest)
public/         manifest, service worker, icons
```

## Honest limitations

- **Playback is a handoff** — DRM makes a custom player impossible. Play opens Netflix's
  official player. Exact `…/title/{id}` once the extension has learned the id; otherwise a
  Netflix title search (labelled "Play (search)").
- **The extension is desktop-browser only** and uses Netflix's unofficial internal API, so
  it can break when Netflix changes. My List reading is best-effort; history sync is the
  robust part. CSV import is the zero-risk fallback.
- **Catalog can lag Netflix slightly** — it reflects TMDB/JustWatch availability data.

## Notes

- Storage is a single gitignored JSON file in `./.data` (zero-setup, local-first). The
  `src/lib/db.ts` surface is small so it can be swapped for a real DB to deploy on a
  read-only-filesystem host.
