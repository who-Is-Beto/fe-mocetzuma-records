import { useCallback, useEffect, useMemo, useState } from "react";
import type { PresaleOrder } from "../domain/presales";
import { createPresaleService } from "../services/presaleService";

/**
 * The signed-in customer's presale orders. Back from Stripe (?presale_session=)
 * it first confirms the payment (the webhook can't reach a local backend) and
 * exposes that order as `justPaid` for the thank-you banner.
 */
export function usePresaleOrders({ token, enabled }: { token: string | null; enabled: boolean }) {
  const service = useMemo(() => createPresaleService({ getToken: () => token }), [token]);
  const [orders, setOrders] = useState<PresaleOrder[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [justPaid, setJustPaid] = useState<PresaleOrder | null>(null);

  const load = useCallback(async () => {
    try {
      setOrders(await service.mine());
    } catch {
      // Not fatal: the regular orders still show.
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [service]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const sessionId = new URLSearchParams(window.location.search).get("presale_session");
    (async () => {
      if (sessionId) {
        try {
          const order = await service.complete(sessionId);
          if (!cancelled) setJustPaid(order);
        } catch {
          // The webhook may still confirm it; the list shows what the server has.
        }
        window.history.replaceState({}, "", window.location.pathname);
      }
      if (!cancelled) await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, load, service]);

  return { orders, loading, justPaid, service, reload: load };
}
