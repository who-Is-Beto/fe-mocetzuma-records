/**
 * Finds the tracklist inside a record's free-text description so the detail
 * page can show it as a list. Descriptions come from Discogs pastes
 * ("A1\t\tTitle\t3:36", "Title\t3:36"), our Discogs import
 * ("  1 - Title (3:45)" under "Contenido (_lista de canciones_):") or by hand
 * ("1. Title 13:04"). Anything that isn't a run of tracks stays text.
 */

/** `credits`: Discogs credit lines under the track ("Remix – Soulchild"). */
export type Track = { position: string; title: string; duration: string; credits?: string[] };

export type DescriptionBlock =
  | { kind: "text"; text: string }
  | { kind: "tracks"; tracks: Track[] };

const TIME = String.raw`\d{1,2}:\d{2}(?::\d{2})?`;
/** "A1", "B10", "A", "1", "12" + tab / " - " / ". " / ") " + the rest. */
const POSITIONED = /^([A-Z]{1,2}\d{0,3}|\d{1,3})(?:\s*\t+\s*|\s+-\s+|[.)]\s+)(.+)$/;
const TRAILING_TIME = new RegExp(String.raw`(?:\t+|\s+)\(?(${TIME})\)?$`);
/** A duration wrapped onto its own line. */
const LONE_TIME = new RegExp(String.raw`^\(?(${TIME})\)?$`);
/** Discogs credit under a track: "Remix – Soulchild", "Written-By [Additional], Featuring – X". */
const CREDIT = /^[^\t]{2,200}\s–\s\S/;
/** "Contenido (_lista de canciones_):", "Tracklist:" — the page shows its own heading. */
const HEADING = /^(contenido|tracklist|lista de canciones|canciones)\b.*:$/i;

function parseTrack(raw: string): Track | null {
  let line = raw.trim();
  let position = "";
  const positioned = POSITIONED.exec(line);
  if (positioned) {
    position = positioned[1];
    line = positioned[2].trim();
  }
  let duration = "";
  const timed = TRAILING_TIME.exec(line);
  if (timed) {
    duration = timed[1];
    line = line.slice(0, timed.index).trim();
  }
  const title = line.replace(/\s*\t+\s*/g, " ").trim();
  if (!title) return null;
  // A tab is how Discogs pastes columns: a strong hint even without times.
  return position || duration || raw.includes("\t") ? { position, title, duration } : null;
}

export function parseDescription(text: string): DescriptionBlock[] {
  const blocks: DescriptionBlock[] = [];
  let prose: string[] = [];
  let heading: string | null = null;
  let run: { track: Track; raw: string }[] = [];

  const flushProse = () => {
    const joined = prose.join("\n").trim();
    if (joined) blocks.push({ kind: "text", text: joined });
    prose = [];
  };
  const endRun = () => {
    // Two tracks in a row (or one under a tracklist heading) make a list.
    if (run.length >= 2 || (heading !== null && run.length > 0)) {
      flushProse();
      blocks.push({ kind: "tracks", tracks: run.map((r) => r.track) });
    } else {
      if (heading !== null) prose.push(heading);
      prose.push(...run.flatMap((r) => [r.raw.trim(), ...(r.track.credits ?? [])]));
    }
    run = [];
    heading = null;
  };

  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  let finalLine = lines.length - 1;
  while (finalLine >= 0 && !lines[finalLine].trim()) finalLine--;
  let afterBlank = false;

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) {
      if (run.length === 0 && heading === null) prose.push(""); // blank lines inside a list don't end it
      afterBlank = true;
      return;
    }
    const wasAfterBlank = afterBlank;
    afterBlank = false;
    const last = run[run.length - 1];
    const lone = LONE_TIME.exec(line);
    if (lone && last && !last.track.duration) {
      last.track.duration = lone[1];
      return;
    }
    if (last && CREDIT.test(line) && !TRAILING_TIME.test(line)) {
      last.track.credits = [...(last.track.credits ?? []), line];
      return;
    }
    // A Discogs paste loses the trailing tab of its very last line ("…\t\r\nHer Majesty").
    if (i === finalLine && run.length >= 2 && !wasAfterBlank && !/[.:]/.test(line) && line.length <= 80) {
      run.push({ track: { position: "", title: line, duration: "" }, raw });
      return;
    }
    if (HEADING.test(line)) {
      endRun();
      heading = line;
      return;
    }
    const track = parseTrack(raw);
    if (track) {
      run.push({ track, raw });
      return;
    }
    endRun();
    prose.push(line);
  });
  endRun();
  flushProse();
  return blocks;
}

/** "3:36" / "1:02:10" → seconds; "" → 0. */
const seconds = (duration: string) =>
  duration.split(":").reduce((total, part) => total * 60 + Number(part), 0);

/** Total running time when every track has one ("47:31", "1:02:10"), else "". */
export function totalDuration(tracks: Track[]): string {
  if (tracks.length === 0 || tracks.some((t) => !t.duration)) return "";
  const total = tracks.reduce((sum, t) => sum + seconds(t.duration), 0);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/** Vinyl side of a position ("A1" → "A", "B" → "B"); "" for plain numbers. */
export const sideOf = (position: string) => /^([A-Z]{1,2})\d*$/.exec(position)?.[1] ?? "";
