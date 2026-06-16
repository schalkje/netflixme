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
  let buildId = null;
  try {
    buildId = window.netflix.reactContext.models.serverDefs.data.BUILD_IDENTIFIER;
  } catch (e) {
    /* not ready */
  }
  if (!buildId) {
    return { error: "Couldn't read your Netflix session. Make sure you're logged in on this tab, then reload netflix.com and try again." };
  }
  log("build id", buildId);

  const history = [];
  try {
    for (let pg = 0; pg < 100; pg++) {
      const res = await fetch(
        `https://www.netflix.com/api/shakti/${buildId}/viewingactivity?pg=${pg}`,
        { credentials: "include", headers: { Accept: "application/json" } }
      );
      if (!res.ok) {
        log("history stopped, http", res.status);
        break;
      }
      const data = await res.json();
      const items = (data && data.viewedItems) || [];
      if (!items.length) break;
      for (const it of items) {
        const title = it.seriesTitle || it.title;
        const netflixId = String(it.series || it.movieID || "");
        if (title) history.push({ title, netflixId });
      }
      log("history page", pg, "→", history.length, "rows");
    }
  } catch (e) {
    return { error: "Reading viewing history failed: " + ((e && e.message) || e) };
  }

  let myList = [];
  try {
    const body = new URLSearchParams();
    body.append("path", JSON.stringify(["mylist", { from: 0, to: 499 }, ["title"]]));
    const res = await fetch(
      `https://www.netflix.com/api/shakti/${buildId}/pathEvaluator?method=get`,
      {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: body.toString(),
      }
    );
    if (res.ok) {
      const data = await res.json();
      const videos =
        (data && data.value && data.value.videos) ||
        (data && data.jsonGraph && data.jsonGraph.videos) ||
        {};
      for (const id in videos) {
        const t = videos[id] && videos[id].title;
        const s = typeof t === "string" ? t : t && t.value;
        if (typeof s === "string") myList.push(s);
      }
    }
    log("my list →", myList.length, "items");
  } catch (e) {
    log("my list read failed (non-fatal)", e);
  }

  return { history, myList };
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
  if (result.error) {
    await setStatus("Netflix read failed", { lastError: result.error });
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
