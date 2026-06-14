# netflixme sync (browser extension)

Reads your **Netflix viewing history** and **My List** from your own logged-in
session on netflix.com and syncs them to your netflixme app, so netflixme can hide
what you've seen and reflect your real list — automatically, no CSV download.

It captures **account-wide** history, so what you watched on your **TV or phone**
shows up too (Netflix records it server-side; this just reads it back).

## How it works

- A page-world content script reuses your existing Netflix login (cookies) to call
  Netflix's internal API (`viewingactivity` + the My List path). It never sees your
  password.
- The data is POSTed to your netflixme backend's `/api/ingest`, authenticated with a
  token you copy from netflixme's **Setup** screen.

## Install (Chrome / Edge / Brave — desktop)

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select this `extension/` folder.
3. Click the extension → **Options** → paste your **netflixme URL** (e.g.
   `http://localhost:3000`) and the **ingest token** from netflixme Setup → **Save**
   (approve the permission prompt for your netflixme URL).
4. Open <https://www.netflix.com> (logged in), click the extension → **Sync now**.

After that it auto-syncs when you visit Netflix (at most every 6 hours) and on a
periodic alarm while a Netflix tab is open.

## Notes & limits

- **Desktop browser only** (extensions don't run on iOS; limited on Android). It only
  needs to run occasionally — it reads your whole account history each time.
- Uses Netflix's **internal** API, which is unofficial and against Netflix's ToS, and
  can change without notice. It's read-only and uses your own session. If My List
  reading breaks, history sync still works; the CSV import in netflixme is the
  zero-risk fallback.
- Playback is unaffected — netflixme always hands off to the official Netflix player.
