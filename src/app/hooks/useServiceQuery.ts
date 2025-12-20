import { useCallback, useEffect, useRef, useState } from "react";

type QueryStatus = "idle" | "loading" | "success" | "error";

type Options<TData> = {
  enabled?: boolean;
  initialData?: TData;
};

export function useServiceQuery<TData>(
  deps: unknown[],
  fetcher: () => Promise<TData>,
  options: Options<TData> = {}
) {
  const { enabled = true, initialData } = options;
  const [data, setData] = useState<TData | undefined>(initialData);
  const [status, setStatus] = useState<QueryStatus>(
    enabled ? "loading" : "idle"
  );
  const [error, setError] = useState<unknown>(null);
  const abortRef = useRef<AbortController | null>(null);

  const refetch = useCallback(async () => {
    if (!enabled) return data;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("loading");
    setError(null);

    try {
      const result = await fetcher();
      if (!controller.signal.aborted) {
        console.log("result", result);
        setData(result);
        setStatus("success");
      }
      return result;
    } catch (err) {
      if (!controller.signal.aborted) {
        setStatus("error");
        setError(err);
      }
      throw err;
    }
  }, [enabled, fetcher]);

  useEffect(() => {
    if (enabled) {
      void refetch();
    }
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, refetch, ...deps]);

  return {
    data,
    error,
    status,
    isLoading: status === "loading",
    isError: status === "error",
    isSuccess: status === "success",
    refetch
  };
}
