import { useCallback, useMemo, useState } from "react";
import {
  createDiscogsService,
  type DiscogsReleaseDetail,
  type DiscogsSearchResult
} from "../services/discogsService";

type Options = {
  token: string | null;
};

/**
 * Admin Discogs lookups (GET /discogs/search + /discogs/releases/:id).
 * Errors are swallowed and degrade to empty results / null, matching how the
 * admin record form always behaved (a failed lookup never blocks the form).
 */
export function useDiscogsSearch({ token }: Options): {
  searching: boolean;
  search(query: string): Promise<DiscogsSearchResult[]>;
  getReleaseDetail(discogsId: number): Promise<DiscogsReleaseDetail | null>;
} {
  const discogsService = useMemo(
    () => createDiscogsService({ getToken: () => token }),
    [token]
  );
  const [searching, setSearching] = useState(false);

  const search = useCallback(
    async (query: string): Promise<DiscogsSearchResult[]> => {
      if (!query.trim() || !token) return [];
      setSearching(true);
      try {
        const data = await discogsService.search(query.trim(), 25);
        return data.results ?? [];
      } catch {
        return [];
      } finally {
        setSearching(false);
      }
    },
    [discogsService, token]
  );

  const getReleaseDetail = useCallback(
    async (discogsId: number): Promise<DiscogsReleaseDetail | null> => {
      if (!token) return null;
      try {
        return await discogsService.releaseDetail(discogsId);
      } catch {
        return null;
      }
    },
    [discogsService, token]
  );

  return { searching, search, getReleaseDetail };
}