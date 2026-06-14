// Service worker: receives Netflix data from the bridge and POSTs it to your
// netflixme backend; also drives periodic + on-demand syncs.

function getCfg() {
  return new Promise((resolve) =>
    chrome.storage.local.get(["backendUrl", "token"], resolve)
  );
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

function broadcast(message) {
  chrome.runtime.sendMessage(message).catch(() => {});
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg) return;

  if (msg.type === "ingest") {
    postIngest(msg.history, msg.myList)
      .then((data) => {
        chrome.storage.local.set({ lastSync: Date.now(), lastResult: data, lastError: null });
        broadcast({ type: "sync-done", data });
      })
      .catch((err) => {
        const error = String((err && err.message) || err);
        chrome.storage.local.set({ lastError: error });
        broadcast({ type: "sync-error", error });
      });
    return false;
  }

  if (msg.type === "sync-now") {
    chrome.tabs.query({ url: "https://*.netflix.com/*" }, (tabs) => {
      if (!tabs.length) {
        const error = "Open a Netflix tab (logged in) first, then Sync.";
        chrome.storage.local.set({ lastError: error });
        broadcast({ type: "sync-error", error });
        sendResponse({ ok: false });
        return;
      }
      chrome.tabs.sendMessage(tabs[0].id, { type: "do-sync" });
      sendResponse({ ok: true });
    });
    return true; // async response
  }

  if (msg.type === "sync-error") {
    chrome.storage.local.set({ lastError: msg.error });
  }
});

// Periodic background sync (only works while a logged-in Netflix tab exists).
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("netflixme-sync", { periodInMinutes: 360 });
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== "netflixme-sync") return;
  chrome.tabs.query({ url: "https://*.netflix.com/*" }, (tabs) => {
    if (tabs.length) chrome.tabs.sendMessage(tabs[0].id, { type: "do-sync" });
  });
});
