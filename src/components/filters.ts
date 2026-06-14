export interface Filters {
  type: "all" | "movie" | "tv";
  sort: "imdb" | "popularity";
  showSeen: boolean;
  mylistOnly: boolean;
  minImdb: number; // 0 = any
  q: string;
  pages: number;
}

export const DEFAULT_FILTERS: Filters = {
  type: "all",
  sort: "imdb",
  showSeen: false,
  mylistOnly: false,
  minImdb: 0,
  q: "",
  pages: 1,
};

export function toQueryString(f: Filters): string {
  const p = new URLSearchParams();
  p.set("type", f.type);
  p.set("sort", f.sort);
  p.set("pages", String(f.pages));
  if (f.showSeen) p.set("showSeen", "1");
  if (f.mylistOnly) p.set("mylistOnly", "1");
  if (f.minImdb > 0) p.set("minImdb", String(f.minImdb));
  if (f.q.trim()) p.set("q", f.q.trim());
  return p.toString();
}
