import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MaintenanceConfig } from "../domain/site";
import { createConfigService } from "../services/configService";
import { canUseOptionalStorage } from "../lib/consent";

type Options = {
  enabled: boolean;
};

// Re-check every 10s while the gate is armed. This matters because the admin
// flips the window from the admin console while storefront tabs may already
// be open: without polling, a tab keeps the stale "open" status and the
// catalog just 503s under the hood. Polling is silent (no loader flash) —
// only the first check after (re)arming shows the loader.
const POLL_INTERVAL_MS = 10_000;

// Last status seen in this browser. The gate only blocks first paint (loader)
// when the window was open last time; otherwise the store renders right away
// and swaps to the notice if a check finds the window open. Waiting on every
// visit pushed the home page's first paint ~1.5 s back on mobile.
const LAST_ACTIVE_KEY = "moctezuma-maintenance-active";

const lastKnownActive = (): boolean => {
  try {
    return localStorage.getItem(LAST_ACTIVE_KEY) === "1";
  } catch {
    return false;
  }
};

const rememberActive = (active: boolean) => {
  // A performance cache: only kept with the visitor's consent.
  if (!canUseOptionalStorage()) return;
  try {
    if (active) localStorage.setItem(LAST_ACTIVE_KEY, "1");
    else localStorage.removeItem(LAST_ACTIVE_KEY);
  } catch {
    // storage blocked: the gate just never blocks first paint
  }
};

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
  const [isLoading, setIsLoading] = useState(() => enabled && lastKnownActive());
  // Holds the latest check closure so callers can force a re-check (e.g. right
  // after the admin closes the window from the storefront banner).
  const checkRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    // Reset to loading each time the gate arms, but only when the window was
    // open last time, so the store doesn't flash before the first check lands.
    setIsLoading(lastKnownActive());

    const check = async () => {
      try {
        const result = await configService.getMaintenanceConfig();
        if (!cancelled) setConfig(result);
        rememberActive(result?.maintenance_mode === true);
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