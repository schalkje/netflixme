// Isolated-world bridge: relays data between the page-world reader (content-main.js)
// and the extension background. This script can use chrome.* APIs; the page-world one cannot.
(function () {
  const MARK = "__netflixme__";

  // Page reader -> background
  window.addEventListener("message", (ev) => {
    if (ev.source !== window) return;
    const d = ev.data;
    if (!d || typeof d !== "object") return;
    if (d[MARK] === "data") {
      chrome.runtime.sendMessage({ type: "ingest", history: d.history, myList: d.myList });
    } else if (d[MARK] === "error") {
      chrome.runtime.sendMessage({ type: "sync-error", error: d.error });
    }
  });

  // Background -> page reader (start a sync)
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "do-sync") {
      window.postMessage({ [MARK]: "sync-request" }, "*");
    }
  });

  // Auto-sync on Netflix page load if it's been a while and we're configured.
  chrome.storage.local.get(["backendUrl", "token", "lastSync"], (cfg) => {
    if (!cfg.backendUrl || !cfg.token) return;
    const stale = !cfg.lastSync || Date.now() - cfg.lastSync > 6 * 3600 * 1000;
    if (stale) setTimeout(() => window.postMessage({ [MARK]: "sync-request" }, "*"), 5000);
  });
})();
