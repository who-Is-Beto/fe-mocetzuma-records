import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { Loader } from "../../components/Loader";
import type { RecordPage, Record as RecordItem } from "../../app/domain/album";
import { useServiceQuery } from "../../app/hooks";
import { createRecordService } from "../../app/services/recordService";
// optional: import { useAuth } from "../../app/providers/AuthProvider";

export const HomePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const parsePage = useCallback((params: URLSearchParams) => {
    const raw = Number(params.get("page"));
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 1;
  }, []);

  const [page, setPage] = useState(() => parsePage(searchParams));
  const searchValue = (searchParams.get("search") ?? "").trim();
  const lastSearchRef = useRef(searchValue);
  const cacheRef = useRef(new Map<string, RecordPage>());

  const normalizeResponse = (
    payload: RecordPage | RecordItem[] | undefined
  ): RecordPage => {
    if (!payload) return { count: 0, next: null, previous: null, results: [] };
    if (Array.isArray(payload)) {
      return {
        count: payload.length,
        next: null,
        previous: null,
        results: payload
      };
    }
    // Some endpoints might return { results: [...] } without count
    return {
      count: payload.count ?? payload.results?.length ?? 0,
      next: payload.next ?? null,
      previous: payload.previous ?? null,
      results: payload.results ?? []
    };
  };

  useEffect(() => {
    const urlPage = parsePage(searchParams);
    if (urlPage !== page) {
      setPage(urlPage);
    }
  }, [searchParams]);

  useEffect(() => {
    const current = parsePage(searchParams);
    if (current !== page) {
      const next = new URLSearchParams(searchParams);
      next.set("page", String(page));
      setSearchParams(next, { replace: true });
    }
  }, [page]);

  useEffect(() => {
    if (searchValue !== lastSearchRef.current) {
      lastSearchRef.current = searchValue;
      cacheRef.current = new Map();
      if (page !== 1) {
        setPage(1);
      }
    }
  }, [searchValue]);
  const recordService = useMemo(
    () =>
      createRecordService({
        // getToken: () => token ?? null,
      }),
    []
    // include `token` in deps if you wire auth: [token]
  );

  const fetchRecords = useCallback(async () => {
    const cacheKey = `${searchValue || "all"}::${page}`;
    const cached = cacheRef.current.get(cacheKey);
    if (cached) return cached;

    try {
      const response = searchValue
        ? await recordService.search({ query: searchValue, page })
        : await recordService.list({ page });
      const normalized = normalizeResponse(response);
      cacheRef.current.set(cacheKey, normalized);
      return normalized;
    } catch (_err) {
      return { count: 0, next: null, previous: null, results: [] };
    }
  }, [recordService, page, searchValue]);

  const { data, error, isLoading, isError, refetch } =
    useServiceQuery<RecordPage>(
      [recordService, page, searchValue],
      fetchRecords
    );

  if (isLoading)
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader />
      </div>
    );
  if (isError)
    return (
      <p>
        Failed to load:{" "}
        {error instanceof Error ? error.message : "Unknown error"}
      </p>
    );

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="font-display text-2xl text-denim">Catálogo</h1>
        <Button
          tone="outline"
          className="px-3 py-1 text-xs"
          onClick={() => refetch()}
        >
          Refetch
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(data?.results ?? []).map((record) => (
          <Card key={record.id} record={record} />
        ))}
      </div>

      {data?.results?.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-navy/10 bg-cream/80 px-4 py-3 shadow-card sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-lg text-denim">
              Disco no encontrado
            </p>
            <p className="text-sm text-navy/70">
              No encontramos coincidencias para tu búsqueda.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              tone="outline"
              onClick={() =>
                window.open(
                  "https://www.instagram.com/moctezuma_records/",
                  "_blank"
                )
              }
              className="text-sm rounded-md"
            >
              Contáctame en Instagram para encargarlo
            </Button>
            <Button
              tone="navy"
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                next.delete("search");
                next.set("page", "1");
                setSearchParams(next, { replace: true });
              }}
              className="text-sm rounded-md"
            >
              regresar al catálogo
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-2 rounded-2xl border border-navy/10 bg-cream/80 px-4 py-3 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-navy/70">
          Página <span className="font-semibold text-denim">{page}</span>
          {data?.count ? (
            <>
              {" "}
              de{" "}
              <span className="font-semibold text-denim">
                {Math.max(
                  1,
                  Math.ceil(data.count / Math.max(1, data.results?.length ?? 1))
                )}
              </span>{" "}
              · {data.count} registros
            </>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button
            tone="outline"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={!data?.previous}
          >
            ← Anterior
          </Button>
          <Button
            tone="navy"
            onClick={() => setPage((p) => p + 1)}
            disabled={!data?.next}
          >
            Siguiente →
          </Button>
        </div>
      </div>
    </section>
  );
};
