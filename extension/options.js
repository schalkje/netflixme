function load() {
  chrome.storage.local.get(["backendUrl", "token"], (c) => {
    document.getElementById("url").value = c.backendUrl || "http://localhost:3000";
    document.getElementById("token").value = c.token || "";
  });
}

async function save() {
  const raw = document.getElementById("url").value.trim().replace(/\/$/, "");
  const token = document.getElementById("token").value.trim();
  const msg = document.getElementById("msg");

  let origin;
  try {
    origin = new URL(raw).origin;
  } catch (_) {
    msg.style.color = "#ff7676";
    msg.textContent = "Invalid URL";
    return;
  }

  // Ask for permission to reach the backend host (needed for the cross-origin POST).
  try {
    await chrome.permissions.request({ origins: [origin + "/*"] });
  } catch (_) {
    /* user may decline; saving still works for localhost in many setups */
  }

  chrome.storage.local.set({ backendUrl: raw, token }, () => {
    msg.style.color = "#6ee7a8";
    msg.textContent = "Saved.";
  });
}

document.addEventListener("DOMContentLoaded", () => {
  load();
  document.getElementById("save").addEventListener("click", save);
});
