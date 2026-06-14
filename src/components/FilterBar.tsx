"use client";

import type { Filters } from "./filters";

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-full border border-edge bg-panel">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
            value === o.value ? "bg-brand text-white" : "text-muted hover:text-white"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function FilterBar({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <input
        className="field"
        placeholder="Search the Netflix catalog…"
        value={filters.q}
        onChange={(e) => onChange({ q: e.target.value })}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={filters.type}
          onChange={(v) => onChange({ type: v })}
          options={[
            { value: "all", label: "All" },
            { value: "movie", label: "Movies" },
            { value: "tv", label: "Series" },
          ]}
        />
        <Segmented
          value={filters.sort}
          onChange={(v) => onChange({ sort: v })}
          options={[
            { value: "imdb", label: "Top IMDb" },
            { value: "popularity", label: "Popular" },
          ]}
        />
        <button
          className={filters.showSeen ? "chip chip-on" : "chip"}
          onClick={() => onChange({ showSeen: !filters.showSeen })}
        >
          {filters.showSeen ? "Showing seen" : "Hiding seen"}
        </button>
        <button
          className={filters.mylistOnly ? "chip chip-on" : "chip"}
          onClick={() => onChange({ mylistOnly: !filters.mylistOnly })}
        >
          My List only
        </button>
        <select
          className="chip cursor-pointer"
          value={filters.minImdb}
          onChange={(e) => onChange({ minImdb: Number(e.target.value) })}
        >
          <option value={0}>Any IMDb</option>
          <option value={6}>6+</option>
          <option value={7}>7+</option>
          <option value={8}>8+</option>
        </select>
      </div>
    </div>
  );
}
