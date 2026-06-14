// Runs in the PAGE's JS world (manifest "world": "MAIN") on netflix.com, so it can
// read Netflix's own globals and call its internal API with your logged-in cookies.
// It never sees your password — it just reuses the session you're already in.
//
// It communicates with the isolated bridge script via window.postMessage; the bridge
// is what talks to the extension + your netflixme backend.
(function () {
  const MARK = "__netflixme__";

  function getBuildId() {
    try {
      return window.netflix.reactContext.models.serverDefs.data.BUILD_IDENTIFIER;
    } catch (_) {
      /* not ready / not logged in */
    }
    return null;
  }

  async function getHistory(buildId) {
    const out = [];
    for (let pg = 0; pg < 100; pg++) {
      const res = await fetch(
        `https://www.netflix.com/api/shakti/${buildId}/viewingactivity?pg=${pg}`,
        { credentials: "include", headers: { Accept: "application/json" } }
      );
      if (!res.ok) break;
      const data = await res.json();
      const items = (data && data.viewedItems) || [];
      if (!items.length) break;
      for (const it of items) {
        const title = it.seriesTitle || it.title;
        const netflixId = String(it.series || it.movieID || "");
        if (title) out.push({ title, netflixId });
      }
    }
    return out;
  }

  // Best-effort My List read via Netflix's Falcor pathEvaluator. If the shape
  // changes we just return [] and skip — history sync still works.
  async function getMyList(buildId) {
    try {
      const body = new URLSearchParams();
      body.append("path", JSON.stringify(["mylist", { from: 0, to: 499 }, ["title"]]));
      const res = await fetch(
        `https://www.netflix.com/api/shakti/${buildId}/pathEvaluator?method=get`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
          body: body.toString(),
        }
      );
      if (!res.ok) return [];
      const data = await res.json();
      const videos =
        (data && data.value && data.value.videos) ||
        (data && data.jsonGraph && data.jsonGraph.videos) ||
        {};
      const titles = [];
      for (const id in videos) {
        const t = videos[id] && videos[id].title;
        const s = typeof t === "string" ? t : t && t.value;
        if (typeof s === "string") titles.push(s);
      }
      return titles;
    } catch (_) {
      return [];
    }
  }

  async function doSync() {
    const buildId = getBuildId();
    if (!buildId) {
      window.postMessage(
        { [MARK]: "error", error: "Couldn't read Netflix session (are you logged in?)" },
        "*"
      );
      return;
    }
    try {
      const history = await getHistory(buildId);
      const myList = await getMyList(buildId);
      window.postMessage({ [MARK]: "data", history, myList }, "*");
    } catch (e) {
      window.postMessage({ [MARK]: "error", error: String((e && e.message) || e) }, "*");
    }
  }

  window.addEventListener("message", (ev) => {
    if (ev.source !== window) return;
    const d = ev.data;
    if (d && d[MARK] === "sync-request") doSync();
  });
})();
