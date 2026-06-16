const $ = (id) => document.getElementById(id);

function ago(ts) {
  if (!ts) return "never";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return s + "s ago";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return new Date(ts).toLocaleString();
}

const ACTIVE = /…|Looking|Reading|Sending/; // status strings that mean "in progress"

function render() {
  chrome.storage.local.get(
    ["backendUrl", "token", "statusText", "statusAt", "lastSync", "lastResult", "lastError", "lastDiag"],
    (c) => {
      const status = $("status");
      const detail = $("detail");
      $("diag").textContent = c.lastError && c.lastDiag ? "diag: " + JSON.stringify(c.lastDiag) : "";

      if (!c.backendUrl || !c.token) {
        status.className = "err";
        status.textContent = "Not configured";
        detail.className = "muted";
        detail.textContent = "Open Options and paste your netflixme URL + ingest token (from Setup).";
        $("lastsync").textContent = "—";
        return;
      }

      const txt = c.statusText || "Idle — press Sync now.";
      const inProgress = c.statusText && ACTIVE.test(c.statusText);
      status.className = c.lastError ? "err" : inProgress ? "muted" : "ok";
      status.innerHTML = (inProgress ? '<span class="spin">↻</span> ' : "") + txt;

      if (c.lastError) {
        detail.className = "err";
        detail.textContent = c.lastError;
      } else if (c.lastResult) {
        const h = c.lastResult.history;
        const m = c.lastResult.myList;
        detail.className = "ok";
        detail.textContent =
          (h ? `${h.matched} watched matched (${h.unmatched} not found)` : "") +
          (m ? ` · ${m.matched} list items` : "");
      } else {
        detail.textContent = "";
      }

      $("lastsync").textContent = ago(c.lastSync);
    }
  );
}

$("sync").addEventListener("click", () => {
  $("status").innerHTML = '<span class="spin">↻</span> Starting…';
  $("status").className = "muted";
  $("detail").textContent = "";
  chrome.storage.local.set({ statusText: "Starting…", lastError: null });
  chrome.runtime.sendMessage({ type: "sync-now" });
});

$("options").addEventListener("click", () => chrome.runtime.openOptionsPage());

// Live updates: react to pushes and also poll (covers the popup reopening).
chrome.runtime.onMessage.addListener(() => render());
setInterval(render, 700);
render();
