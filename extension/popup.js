function render() {
  chrome.storage.local.get(
    ["backendUrl", "token", "lastSync", "lastResult", "lastError"],
    (c) => {
      const status = document.getElementById("status");
      const result = document.getElementById("result");
      if (!c.backendUrl || !c.token) {
        status.textContent = "Not configured — open Options and paste your netflixme URL + token.";
        result.textContent = "";
        return;
      }
      status.textContent = c.lastSync
        ? "Last sync: " + new Date(c.lastSync).toLocaleString()
        : "Never synced yet.";
      if (c.lastError) {
        result.style.color = "#ff7676";
        result.textContent = "Error: " + c.lastError;
      } else if (c.lastResult) {
        const h = c.lastResult.history;
        const m = c.lastResult.myList;
        result.style.color = "#6ee7a8";
        result.textContent =
          (h ? `${h.matched} watched matched` : "") + (m ? ` · ${m.matched} list matched` : "");
      } else {
        result.textContent = "";
      }
    }
  );
}

document.getElementById("sync").addEventListener("click", () => {
  chrome.storage.local.remove("lastError");
  document.getElementById("status").textContent = "Syncing… keep the Netflix tab open.";
  document.getElementById("result").textContent = "";
  chrome.runtime.sendMessage({ type: "sync-now" });
});

document.getElementById("options").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

chrome.runtime.onMessage.addListener(() => render());
document.addEventListener("DOMContentLoaded", render);
render();
