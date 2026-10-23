import { useMemo } from "react";
import { parseDescription, sideOf, totalDuration, type Track } from "../../app/lib/tracklist";

/** Tracks split by vinyl side ("A1", "B2"…); one untitled group for plain numbers. */
function bySide(tracks: Track[]): { side: string; tracks: Track[] }[] {
  const groups: { side: string; tracks: Track[] }[] = [];
  for (const track of tracks) {
    const side = sideOf(track.position);
    const last = groups[groups.length - 1];
    if (last && last.side === side) last.tracks.push(track);
    else groups.push({ side, tracks: [track] });
  }
  // Sides only help when there are at least two of them.
  return groups.length > 1 && groups.every((g) => g.side) ? groups : [{ side: "", tracks }];
}

function Tracklist({ tracks }: { tracks: Track[] }) {
  const total = totalDuration(tracks);
  const groups = bySide(tracks);
  return (
    <div className="rounded-xl border border-navy/10 bg-cream/60 shadow-inner">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-navy/10 px-3 py-2.5 sm:px-4">
        <p className="whitespace-nowrap text-xs uppercase tracking-[0.14em] text-orange">Lista de canciones</p>
        <p className="whitespace-nowrap text-[11px] font-semibold text-navy/50 tabular-nums">
          {tracks.length} {tracks.length === 1 ? "canción" : "canciones"}
          {total && ` · ${total}`}
        </p>
      </div>
      {groups.map((group) => (
        <section key={group.side || "all"} aria-label={group.side ? `Lado ${group.side}` : undefined}>
          {group.side && (
            <p className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-denim/70 sm:px-4">
              Lado {group.side}
            </p>
          )}
          <ol className="divide-y divide-navy/5">
            {group.tracks.map((track, i) => (
              <li
                key={`${track.position}-${i}`}
                className="flex items-start gap-3 px-3 py-2 sm:px-4"
              >
                <span
                  aria-hidden={!track.position}
                  className="mt-px w-7 shrink-0 text-[11px] font-semibold tabular-nums text-orange"
                >
                  {track.position || (group.side ? "" : i + 1)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm leading-snug text-navy">{track.title}</span>
                  {track.credits?.map((credit) => (
                    <span key={credit} className="mt-0.5 block text-[11px] leading-snug text-navy/50">
                      {credit}
                    </span>
                  ))}
                </span>
                {track.duration && (
                  <span className="mt-px shrink-0 text-xs tabular-nums text-navy/50">{track.duration}</span>
                )}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

/** The description with its tracklist (if it has one) shown as a list. */
export function RecordDescription({ description }: { description?: string | null }) {
  const blocks = useMemo(() => parseDescription(description ?? ""), [description]);
  if (blocks.length === 0) {
    return <p className="text-sm text-navy/60">Sin descripción</p>;
  }
  return (
    <div className="space-y-3">
      {blocks.map((block, i) =>
        block.kind === "tracks" ? (
          <Tracklist key={i} tracks={block.tracks} />
        ) : (
          <p key={i} className="whitespace-pre-line break-words text-sm leading-relaxed text-navy/80">
            {block.text}
          </p>
        )
      )}
    </div>
  );
}
