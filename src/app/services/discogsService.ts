import { API_BASE_URL } from "../config/api";
import { http } from "../lib/httpClient";

/** One hit from GET /discogs/search/ (already flattened by the backend). */
export type DiscogsSearchResult = {
  discogs_id: number;
  title: string;
  artist: string;
  year: number | null;
  cover_image: string;
  genre: string;
  style: string;
  format: string;
  formats: string[];
  resource_url: string;
  uri: string;
};

/** Payload of GET /discogs/releases/:id/ (see apiApp/services/discogs.py). */
export type DiscogsReleaseDetail = {
  discogs_id?: number;
  title?: string;
  description?: string;
  images?: string[];
  tracklist?: unknown[];
  year?: number | null;
  genres?: string[];
  styles?: string[];
  formats?: string[];
  format_details?: unknown;
  estimated_weight?: number | null;
  weight_grams_suggestion?: number | null;
  country?: string;
  labels?: string[];
  master_id?: number | null;
};

type DiscogsServiceConfig = {
  baseUrl?: string;
  getToken?: () => string | null;
};

const withBase = (baseUrl: string, path: string) =>
  `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}/`;

/**
 * Repository for the backend's Discogs proxy endpoints, used by the admin
 * record form to search releases and import details.
 */
export function createDiscogsService(config: DiscogsServiceConfig = {}): {
  search(query: string, perPage?: number): Promise<{ results: DiscogsSearchResult[] }>;
  releaseDetail(discogsId: number): Promise<DiscogsReleaseDetail>;
} {
  const baseUrl = config.baseUrl ?? API_BASE_URL;
  const getToken = config.getToken;

  return {
    async search(query, perPage = 25) {
      return http<{ results: DiscogsSearchResult[] }>(
        withBase(baseUrl, "/discogs/search"),
        {
          token: getToken?.() ?? undefined,
          query: { q: query, per_page: perPage }
        }
      );
    },
    async releaseDetail(discogsId) {
      return http<DiscogsReleaseDetail>(
        withBase(baseUrl, `/discogs/releases/${discogsId}`),
        { token: getToken?.() ?? undefined }
      );
    }
  };
}