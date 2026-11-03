import { API_BASE_URL } from "../config/api";
import type { DiscogsAlbum, RecordRequestRepository } from "../domain/recordRequest";
import { http } from "../lib/httpClient";

/** Repository for /record-requests/ (public, rate-limited). */
export function createRecordRequestService(baseUrl: string = API_BASE_URL): RecordRequestRepository {
  const root = `${baseUrl.replace(/\/$/, "")}/record-requests`;
  return {
    async send(request) {
      await http(`${root}/`, { method: "POST", body: request });
    },
    async searchDiscogs(query, signal) {
      const data = await http<{ results: DiscogsAlbum[] }>(`${root}/discogs/`, { query: { q: query }, signal });
      return data.results;
    },
    async discogsFormats({ kind, id }) {
      const data = await http<{ formats: string[] }>(`${root}/discogs/${kind}/${id}/formats/`);
      return data.formats;
    }
  };
}
