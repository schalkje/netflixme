// Service worker: on demand it injects a reader into your Netflix tab, gets your
// history + My List back directly, and POSTs them to your netflixme backend.
// Every step is written to storage as `statusText` so the popup can show live,
// persistent progress (even after it closes and reopens).

const NETFLIX_MATCH = "https://*.netflix.com/*";

function log(...a) {
  console.log("[netflixme bg]", ...a);
}

async function setStatus(statusText, extra) {
  await chrome.storage.local.set({ statusText, statusAt: Date.now(), ...(extra || {}) });
  chrome.runtime.sendMessage({ type: "status" }).catch(() => {});
  log(statusText, extra || "");
}

function getCfg() {
  return new Promise((resolve) => chrome.storage.local.get(["backendUrl", "token"], resolve));
}

async function postIngest(history, myList) {
  const { backendUrl, token } = await getCfg();
  if (!backendUrl || !token) {
    throw new Error("Not configured — set the netflixme URL + token in Options.");
  }
  const res = await fetch(backendUrl.replace(/\/$/, "") + "/api/ingest", {
    method: "POST",
    headers: { "content-type": "application/json", "x-netflixme-token": token },
    body: JSON.stringify({ history: history || [], myList: myList || [] }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "HTTP " + res.status);
  return data;
}

// This function is serialized and injected into the Netflix page (MAIN world),
// so it can use your logged-in session. It must be fully self-contained.
async function netflixReader() {
  const log = (...a) => console.log("[netflixme reader]", ...a);
  const out = { history: [], myList: [], diag: {} };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // Netflix's edge intermittently returns 421 (Misdirected Request) to fetches on
  // a long-open tab's coalesced HTTP/2 connection. Retry a few times; a transient
  // 421/429/5xx often clears on a fresh attempt.
  async function req(url, opts, tries) {
    let last = 0;
    for (let i = 0; i < (tries || 4); i++) {
      let res;
      try {
        res = await fetch(url, Object.assign({ credentials: "include", cache: "no-store" }, opts));
      } catch (e) {
        last = -1;
        await sleep(300 * (i + 1));
        continue;
      }
      last = res.status;
      if (res.status !== 421 && res.status !== 429 && res.status < 500) return res;
      await sleep(300 * (i + 1));
    }
    return { ok: false, status: last, json: async () => ({}), text: async () => "" };
  }

  let buildId = null;
  try {
    buildId = window.netflix.reactContext.models.serverDefs.data.BUILD_IDENTIFIER;
  } catch (e) {
    /* not ready */
  }
  out.diag.buildId = Boolean(buildId);
  try {
    out.diag.host = location.host;
    out.diag.path = location.pathname;
  } catch (e) {
    /* ignore */
  }
  if (!buildId) {
    out.error =
      "Couldn't read your Netflix session. Open netflix.com, log in, pick a profile, then Sync again.";
    return out;
  }
  log("build id", buildId);

  const API = `https://www.netflix.com/api/shakti/${buildId}`;
  const jsonHeaders = { Accept: "application/json" };

  // --- viewing history (REST), with retry ---
  try {
    for (let pg = 0; pg < 100; pg++) {
      const res = await req(`${API}/viewingactivity?pg=${pg}&pgSize=40`, { headers: jsonHeaders });
      if (pg === 0) {
        out.diag.vaStatus = res.status;
      }
      if (!res.ok) break;
      const data = await res.json();
      if (pg === 0) out.diag.vaKeys = Object.keys(data || {});
      const items = (data && data.viewedItems) || [];
      if (!items.length) break;
      for (const it of items) {
        const title = it.seriesTitle || it.title;
        const netflixId = String(it.series || it.movieID || "");
        if (title) out.history.push({ title, netflixId });
      }
      log("history page", pg, "→", out.history.length, "rows");
    }
  } catch (e) {
    out.diag.vaError = String((e && e.message) || e);
  }

  // --- My List (Falcor pathEvaluator), with retry + real client params ---
  try {
    const body = new URLSearchParams();
    body.append("path", JSON.stringify(["mylist", { from: 0, to: 499 }, ["title"]]));
    const res = await req(
      `${API}/pathEvaluator?method=get&falcor_server=0.1.0&materialize=true`,
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: body.toString(),
      }
    );
    out.diag.mlStatus = res.status;
    if (res.ok) {
      const data = await res.json();
      const videos =
        (data && data.value && data.value.videos) ||
        (data && data.jsonGraph && data.jsonGraph.videos) ||
        {};
      for (const id in videos) {
        const t = videos[id] && videos[id].title;
        const s = typeof t === "string" ? t : t && t.value;
        if (typeof s === "string") out.myList.push(s);
      }
    }
    log("my list →", out.myList.length, "items");
  } catch (e) {
    out.diag.mlError = String((e && e.message) || e);
  }

  // --- Fallback: if the API gave us no history, scrape the viewing-activity page's
  //     embedded falcorCache (a normal document GET, not the 421-prone API). ---
  if (out.history.length === 0) {
    try {
      const res = await req("https://www.netflix.com/viewingactivity", {
        headers: { Accept: "text/html" },
      });
      out.diag.htmlStatus = res.status;
      if (res.ok) {
        const html = await res.text();
        const m = html.match(/netflix\.falcorCache\s*=\s*(\{[\s\S]*?\})\s*;\s*<\/script>/);
        if (m) {
          let cache = null;
          try {
            cache = JSON.parse(m[1]);
          } catch (e) {
            out.diag.htmlParse = "json-fail";
          }
          const videos = (cache && cache.videos) || {};
          let n = 0;
          for (const id in videos) {
            const t = videos[id] && videos[id].title;
            const s = typeof t === "string" ? t : t && t.value;
            if (typeof s === "string") {
              out.history.push({ title: s, netflixId: String(id) });
              n++;
            }
          }
          out.diag.htmlVideos = n;
          log("html fallback →", n, "titles");
        } else {
          out.diag.htmlParse = "no-cache";
        }
      }
    } catch (e) {
      out.diag.htmlError = String((e && e.message) || e);
    }
  }

  return out;
}

async function syncNow(reason) {
  await setStatus("Looking for an open Netflix tab…", { lastError: null });

  const tabs = await chrome.tabs.query({ url: NETFLIX_MATCH });
  if (!tabs.length) {
    await setStatus("No Netflix tab found", {
      lastError: "Open https://www.netflix.com in a tab (and log in), then press Sync.",
    });
    return;
  }
  const tab = tabs.find((t) => t.active) || tabs[0];
  log("using tab", tab.id, tab.url, "reason:", reason);

  await setStatus("Reading your Netflix account… (this can take a few seconds)");
  let injection;
  try {
    injection = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      func: netflixReader,
    });
  } catch (e) {
    await setStatus("Couldn't read the Netflix tab", {
      lastError:
        "Injection failed: " +
        ((e && e.message) || e) +
        ". Reload the Netflix tab and try again.",
    });
    return;
  }

  const result = injection && injection[0] && injection[0].result;
  if (!result) {
    await setStatus("No data came back", {
      lastError: "The reader returned nothing. Reload the Netflix tab and retry.",
    });
    return;
  }
  log("reader diag", result.diag, "history", (result.history || []).length, "mylist", (result.myList || []).length);
  if (result.error) {
    await setStatus("Netflix read failed", { lastError: result.error, lastDiag: result.diag });
    return;
  }

  const total = (result.history || []).length + (result.myList || []).length;
  if (total === 0) {
    const d = result.diag || {};
    let hint;
    if (d.vaStatus && d.vaStatus !== 200) {
      hint =
        `Netflix's viewing-activity API returned HTTP ${d.vaStatus}. ` +
        "You're likely on the 'Who's watching?' screen or not fully logged in — open a profile and the main Netflix browse page, then Sync again.";
    } else {
      hint =
        "Netflix returned no viewing history" +
        (d.vaKeys ? ` (response keys: ${d.vaKeys.join(", ") || "none"})` : "") +
        ". Open a profile and browse Netflix, then Sync. If it persists, the Netflix API may have changed — use Import CSV as a fallback.";
    }
    await setStatus("Netflix returned 0 items", { lastError: hint, lastDiag: d });
    return;
  }

  await setStatus(
    `Read ${result.history.length} history rows and ${result.myList.length} list items. Sending to netflixme…`
  );
  try {
    const data = await postIngest(result.history, result.myList);
    await setStatus("Synced ✓", { lastSync: Date.now(), lastResult: data, lastError: null });
  } catch (e) {
    await setStatus("Couldn't reach netflixme", {
      lastError:
        ((e && e.message) || e) +
        ". Check the netflixme URL + token in Options, and that the app is running.",
    });
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "sync-now") {
    syncNow("manual");
    sendResponse({ ok: true });
    return true;
  }
});

// Periodic + on-load auto-sync (stale-gated), now that injection is on-demand.
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("netflixme-sync", { periodInMinutes: 360 });
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "netflixme-sync") syncNow("alarm");
});
chrome.tabs.onUpdated.addListener((_tabId, info, tab) => {
  if (info.status !== "complete" || !tab.url || !tab.url.includes("netflix.com")) return;
  chrome.storage.local.get(["backendUrl", "token", "lastSync"], (c) => {
    if (!c.backendUrl || !c.token) return;
    const stale = !c.lastSync || Date.now() - c.lastSync > 6 * 3600 * 1000;
    if (stale) setTimeout(() => syncNow("tab-load"), 4000);
  });
});
