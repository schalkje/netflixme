"use client";

import type { CatalogItem } from "@/lib/types";
import type { ActionKind } from "@/lib/actions";

function ImdbBadge({ rating }: { rating?: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-bold">
      <span className="rounded-sm bg-[#f5c518] px-1 text-black">IMDb</span>
      <span className="text-white">{rating != null ? rating.toFixed(1) : "—"}</span>
    </span>
  );
}

const STATUS_LABEL: Record<string, string> = {
  seen: "Seen",
  mylist: "My List",
  dropped: "Never again",
  hidden: "Hidden",
};

export default function TitleCard({
  item,
  busy,
  onAction,
}: {
  item: CatalogItem;
  busy: boolean;
  onAction: (action: ActionKind) => void;
}) {
  const inList = item.status === "mylist";
  const seen = item.status === "seen";
  const never = item.status === "dropped" || item.status === "hidden";
  // Tint posters by status: seen -> grayscale, never-again -> grayscale + red wash.
  const toneClass = seen ? "grayscale opacity-75" : never ? "grayscale opacity-90" : "";
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-lg bg-panel ring-1 ring-edge/60">
      <div className="relative aspect-[2/3] w-full bg-edge">
        {item.poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.poster}
            alt={item.title}
            loading="lazy"
            className={`h-full w-full object-cover ${toneClass}`}
          />
        ) : (
          <div
            className={`flex h-full w-full items-center justify-center p-3 text-center text-xs text-muted ${toneClass}`}
          >
            {item.title}
          </div>
        )}
        {never && (
          <div className="pointer-events-none absolute inset-0 bg-red-800/35 mix-blend-multiply" />
        )}
        <div className="absolute left-1.5 top-1.5">
          <ImdbBadge rating={item.imdbRating} />
        </div>
        {item.status && (
          <div
            className={`absolute right-1.5 top-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              seen ? "bg-zinc-600/90" : never ? "bg-red-900/90" : "bg-brand/90"
            }`}
          >
            {STATUS_LABEL[item.status]}
          </div>
        )}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs">
            …
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-2.5">
        <div className="min-h-[2.5rem]">
          <p className="line-clamp-2 text-sm font-medium leading-snug">{item.title}</p>
          <p className="text-[11px] text-muted">
            {item.type === "tv" ? "Series" : "Movie"}
            {item.year ? ` · ${item.year}` : ""}
          </p>
        </div>

        <div className="mt-auto flex flex-col gap-1.5">
          <a
            href={item.playUrl}
            target="_blank"
            rel="noreferrer"
            className="btn-primary w-full"
            title={
              item.playIsSearch
                ? "Opens a Netflix search for this title (exact deep-link unavailable)"
                : "Opens this title on Netflix"
            }
          >
            ▶ Play{item.playIsSearch ? " (search)" : ""}
          </a>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              className={inList ? "btn-primary" : "btn-ghost"}
              disabled={busy}
              onClick={() => onAction(inList ? "remove" : "mylist")}
            >
              {inList ? "✓ Listed" : "+ My List"}
            </button>
            <button className="btn-ghost" disabled={busy} onClick={() => onAction("seen")}>
              ✓ Seen
            </button>
            <button className="btn-ghost" disabled={busy} onClick={() => onAction("dropped")}>
              ✕ Never
            </button>
            <button className="btn-ghost" disabled={busy} onClick={() => onAction("hidden")}>
              ⨯ Hide
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
