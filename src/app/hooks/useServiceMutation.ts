import { useCallback, useState } from "react";

type MutationStatus = "idle" | "loading" | "success" | "error";

type MutationOptions<TData, TVariables> = {
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: unknown, variables: TVariables) => void;
  onSettled?: (data: TData | undefined, error: unknown, variables: TVariables) => void;
};

export function useServiceMutation<TData, TVariables = void>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: MutationOptions<TData, TVariables> = {}
) {
  const [data, setData] = useState<TData | undefined>(undefined);
  const [error, setError] = useState<unknown>(null);
  const [status, setStatus] = useState<MutationStatus>("idle");

  const mutateAsync = useCallback(
    async (variables: TVariables) => {
      setStatus("loading");
      setError(null);
      try {
        const result = await mutationFn(variables);
        setData(result);
        setStatus("success");
        options.onSuccess?.(result, variables);
        options.onSettled?.(result, null, variables);
        return result;
      } catch (err) {
        setStatus("error");
        setError(err);
        options.onError?.(err, variables);
        options.onSettled?.(undefined, err, variables);
        throw err;
      }
    },
    [mutationFn, options],
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setData(undefined);
  }, []);

  return {
    data,
    error,
    status,
    isIdle: status === "idle",
    isLoading: status === "loading",
    isError: status === "error",
    isSuccess: status === "success",
    mutate: mutateAsync,
    mutateAsync,
    reset,
  };
}
