# netflixme

A better Netflix UI that:

- **filters out whatever you've seen**
- **filters out whatever you don't want to see again**
- **manages your "my list"**
- **looks up the IMDb scores** of movies and series

Runs as an installable **web app (PWA)** on mobile and desktop. Browse on your
phone, tap **Play**, and Netflix's own app takes over — including casting to your TV.

---

## How it works (and why it's built this way)

Netflix **has no public API** (it was shut down in 2014) and its video is locked
behind DRM, so **no third-party app can read your account or play Netflix content
in a custom player** — every comparable product (Reelgood, JustWatch, Simkl) instead
deep-links into the official Netflix app to play. netflixme does the same and, rather
than reverse-engineering Netflix, builds on a mature tracking backbone:

| Need | Source |
| --- | --- |
| What's on Netflix (your region) | **TMDB** watch-providers (JustWatch data) |
| IMDb scores | **OMDb** |
| Seen / My List / Never-again | **Simkl** (public API, OAuth) |
| Auto-tracking what you watch | Simkl's **"Enhancer for Netflix"** browser extension (desktop) |
| TV/phone watching | **Netflix viewing-activity CSV** import (in-app) |
| Playback | Deep-link to the **official Netflix app** |

```
Browser (phone + desktop) → Next.js API routes → local JSON store (./.data)
        │                          │                       │
   Simkl (OAuth)        TMDB catalog + OMDb IMDb     deep-link netflix.com
   seen/list/dropped    (what's on Netflix here)     (title or search) → cast to TV
```

## Requirements

- Node.js 18+ (developed on Node 24)
- Free API keys (all free, entered in the in-app **Setup** screen or `.env.local`):
  - **TMDB** v3 key — <https://www.themoviedb.org/settings/api> *(required: the catalog)*
  - **OMDb** key — <https://www.omdbapi.com/apikey.aspx> *(IMDb scores)*
  - **Simkl** app — <https://simkl.com/settings/developer> *(your lists + watched)*
    - Set its redirect URI to `http://localhost:3000/api/auth/simkl/callback`

## Getting started

```bash
npm install
cp .env.local.example .env.local   # optional — you can enter keys in the UI instead
npm run dev                        # http://localhost:3000
```

1. Open the app → it sends you to **Setup**. Enter your TMDB key (minimum), plus
   OMDb and Simkl, and your region (e.g. `NL`).
2. Back on the home page, click **Connect Simkl** and authorize.
3. Click **↻ Sync** to pull your Simkl library — seen titles and never-again titles
   drop out of the catalog; your list is flagged.
4. **Auto-tracking:** install Simkl's "Enhancer for Netflix" extension in your
   desktop browser so future watching is logged automatically.
5. **TV/phone history:** on Netflix (desktop) go to *Account → Profile → Viewing
   activity → Download all*, then use **Import CSV** in netflixme to mark those as seen.

### Install on your phone

Open the dev/deployed URL on your phone (same network, or via Tailscale) and use
**Add to Home Screen**. It runs fullscreen as an app. Tapping **Play** opens the
Netflix app, from which you can cast to your TV.

## Usage

- **Filters:** All / Movies / Series, Top-IMDb / Popular sort, min-IMDb, search, and
  toggles for *Showing seen* and *My List only*. Seen + never-again are hidden by default.
- **Per title:** Play, + My List, ✓ Seen, ✕ Never again, ⨯ Hide. Writes through to
  Simkl when connected (Hide is local-only), with optimistic UI.

## Project layout

```
src/lib/        db (JSON store), settings, crypto, simkl, tmdb, omdb,
                sync, catalog, csv, actions, netflix deep-links
src/app/api/    health, settings, auth/simkl/*, sync, catalog, title/action, csv
src/app/        page (catalog), setup
src/components/ CatalogApp, FilterBar, TitleCard, CsvImport, SetupForm
public/         manifest, service worker, icons
```

## Honest limitations

- **Playback is a handoff, not in-app** — Netflix DRM makes a custom player
  impossible. By design, Play opens Netflix's official player.
- **Play often falls back to a Netflix search** — TMDB doesn't expose Netflix title
  ids/deep-links, so when the exact id is unknown, Play opens a Netflix search for the
  title (still one tap). Labelled "Play (search)" on those cards.
- **TV/phone watching isn't auto-captured live** — only the CSV import (or re-watching
  in a desktop browser with the extension) records it. No one can hook the Netflix TV/
  mobile apps cleanly.
- **Catalog can lag Netflix slightly** — it reflects TMDB/JustWatch availability data.

## Notes

- Storage is a single gitignored JSON file in `./.data` (zero-setup, local-first).
  Simkl tokens are encrypted at rest with `NETFLIXME_SECRET` (set one in production).
- Deploys unchanged to a Node host (Docker / a long-running server). Serverless
  platforms with a read-only filesystem would need the store swapped for a real DB
  (the `src/lib/db.ts` surface is intentionally small to make that easy).
