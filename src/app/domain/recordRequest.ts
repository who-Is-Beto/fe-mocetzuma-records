/**
 * "Encargar un disco": a visitor asks the store to find a record. Mirrors
 * apiApp/views/record_requests.py — nothing is stored, it's emailed to the store.
 */
export type RecordRequest = {
  name: string;
  email: string;
  artist: string;
  title: string;
  format?: string;
  details?: string;
  message?: string;
  /** Set when the visitor picked the record from the Discogs search. */
  year?: number | null;
  discogs_url?: string;
  cover_url?: string;
  /** Honeypot: always empty for people. */
  website?: string;
};

/** GET /record-requests/discogs/?q= — one result per album (master, or a release without one). */
export type DiscogsAlbum = {
  id: number;
  kind: "master" | "release";
  artist: string;
  title: string;
  year: string | number | null;
  thumb: string | null;
  cover: string | null;
  url: string | null;
};

export interface RecordRequestRepository {
  send(request: RecordRequest): Promise<void>;
  searchDiscogs(query: string, signal?: AbortSignal): Promise<DiscogsAlbum[]>;
  /** Formats the album was actually released in ("LP", "CD", "Casete"…). */
  discogsFormats(album: Pick<DiscogsAlbum, "kind" | "id">): Promise<string[]>;
}
