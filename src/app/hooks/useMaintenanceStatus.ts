import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MaintenanceConfig } from "../domain/site";
import { createConfigService } from "../services/configService";

type Options = {
  enabled: boolean;
};

// Re-check every 10s while the gate is armed. This matters because the admin
// flips the window from the admin console while storefront tabs may already
// be open: without polling, a tab keeps the stale "open" status and the
// catalog just 503s under the hood. Polling is silent (no loader flash) —
// only the first check after (re)arming shows the loader.
const POLL_INTERVAL_MS = 10_000;

/**
 * Public maintenance status for the storefront boot gate. Never sends a token
 * (the endpoint must keep answering while the window is open) and treats a
 * failed/unreachable backend as "open" so the site still renders.
 */
export function useMaintenanceStatus({
  enabled
}: Options): {
  config: MaintenanceConfig | null;
  isLoading: boolean;
  refetch(): void;
} {
  const configService = useMemo(() => createConfigService(), []);
  const [config, setConfig] = useState<MaintenanceConfig | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  // Holds the latest check closure so callers can force a re-check (e.g. right
  // after the admin closes the window from the storefront banner).
  const checkRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    // Reset to loading each time the gate arms so the store doesn't flash
    // before the first status check lands (e.g. right after an admin logs out).
    setIsLoading(true);

    const check = async () => {
      try {
        const result = await configService.getMaintenanceConfig();
        if (!cancelled) setConfig(result);
      } catch {
        // backend unreachable → assume the store is open
        if (!cancelled) setConfig(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    checkRef.current = check;

    void check();
    const id = window.setInterval(() => void check(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      checkRef.current = null;
      window.clearInterval(id);
    };
  }, [enabled, configService]);

  const refetch = useCallback(() => {
    void checkRef.current?.();
  }, []);

  return { config, isLoading, refetch };
}