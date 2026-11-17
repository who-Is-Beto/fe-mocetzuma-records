import { useCallback, useMemo } from "react";
import type { Presale } from "../../app/domain/presales";
import { useServiceQuery } from "../../app/hooks";
import { createPresaleService } from "../../app/services/presaleService";
import { visiblePresales } from "./presaleText";

/**
 * The presales the public lists show (home carousel, /preventas), in display
 * order. A failed request is an empty list: the rest of the page still works.
 */
export function usePublishedPresales() {
  const service = useMemo(() => createPresaleService(), []);
  const fetchPresales = useCallback(() => service.list().catch(() => [] as Presale[]), [service]);
  const { data, isLoading } = useServiceQuery<Presale[]>([service], fetchPresales);
  const presales = useMemo(() => visiblePresales(data ?? []), [data]);
  return { presales, isLoading };
}
