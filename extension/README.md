# netflixme sync (browser extension)

Reads your **Netflix viewing history** and **My List** from your own logged-in
session on netflix.com and syncs them to your netflixme app, so netflixme can hide
what you've seen and reflect your real list — automatically, no CSV download.

It captures **account-wide** history, so what you watched on your **TV or phone**
shows up too (Netflix records it server-side; this just reads it back).

## How it works

When you click **Sync now**, the extension injects a small reader into your open
Netflix tab (using your existing login — never your password), reads your viewing
history + My List via Netflix's internal API, and POSTs them to your netflixme
backend's `/api/ingest`, authenticated with a token from netflixme's **Setup** screen.

## Install (Chrome / Edge / Brave — desktop)

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select this `extension/` folder.
3. Click the extension → **Options** → paste your **netflixme URL** (e.g.
   `http://localhost:3000`) and the **ingest token** from netflixme Setup → **Save**
   (approve the permission prompt for your netflixme URL).
4. Open <https://www.netflix.com> (logged in) in a tab.
5. Click the extension → **Sync now**. The popup shows live status; when it says
   **Synced ✓** your watched titles drop out of the netflixme catalog.

After that it also auto-syncs when you open Netflix (at most every 6 hours).

## Seeing what's happening / troubleshooting

The popup now shows a **live status line** ("Reading your Netflix account…",
"Sending…", "Synced ✓", or a specific error) and the last-sync time. It keeps
updating even if you close and reopen it.

For deeper logs:

- **Background log:** `chrome://extensions` → netflixme sync → **service worker**
  → *Inspect* → Console. Lines are prefixed `[netflixme bg]`.
- **Reader log:** open DevTools on the **Netflix tab** → Console. Lines are prefixed
  `[netflixme reader]` and show history pages as they load.

Common fixes:

- **"No Netflix tab found"** — open netflix.com in a tab and log in, then Sync.
- **"Couldn't read your Netflix session"** — reload the Netflix tab (you must be
  logged in) and Sync again.
- **"Couldn't reach netflixme"** — check the URL + token in Options and that the app
  is running; re-approve the host permission in Options if needed.

## Notes & limits

- **Desktop browser only** (extensions don't run on iOS; limited on Android). It only
  needs to run occasionally — it reads your whole account history each time.
- Uses Netflix's **internal** API, which is unofficial and against Netflix's ToS, and
  can change without notice. It's read-only and uses your own session. If My List
  reading breaks, history sync still works; the CSV import in netflixme is the
  zero-risk fallback.
- Playback is unaffected — netflixme always hands off to the official Netflix player.
