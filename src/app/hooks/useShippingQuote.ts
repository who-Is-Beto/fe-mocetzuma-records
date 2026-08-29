import { useEffect, useMemo, useState } from "react";
import type { ShippingQuoteResponse } from "../domain/shipping";
import { createShippingService } from "../services/shippingService";

type Options = {
  token: string | null;
  /** Cart to quote for. Null when no cart exists yet. */
  cartCode: string | null;
  /** ZIP to quote against; blank or malformed → no quote. */
  zip: string;
  /** Only quote while true (the page enables it for home delivery). */
  enabled: boolean;
  /**
   * Extra value that re-triggers the quote when it changes — e.g. a cart
   * content signature, since quantity changes alter package weight.
   */
  version?: unknown;
  debounceMs?: number;
};

/**
 * Live shipping quote (POST /shipping/quote/) with a debounce: once a
 * home-delivery ZIP is complete it asks Envíos Perros for the cost, mirroring
 * the previous CartPage inline effect. The final charge is always re-quoted
 * server-side at checkout.
 */
export function useShippingQuote({
  token,
  cartCode,
  zip,
  enabled,
  version,
  debounceMs = 600
}: Options): {
  quote: ShippingQuoteResponse | null;
  isQuoting: boolean;
  error: string | null;
} {
  const [quote, setQuote] = useState<ShippingQuoteResponse | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shippingService = useMemo(
    () => createShippingService({ getToken: () => token }),
    [token]
  );

  useEffect(() => {
    if (!enabled || !cartCode) {
      // Intentional reset: when the cart/enabled flag drops out, stale quote
      // results must clear immediately (no debounce cascade).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuote(null);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError(null);
      return;
    }
    const trimmedZip = zip.trim();
    if (!/^\d{5}$/.test(trimmedZip)) {
      // Same guard for a ZIP that is no longer complete/valid.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuote(null);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError(null);
      return;
    }
    let cancelled = false;
    setIsQuoting(true);
    const timer = setTimeout(() => {
      shippingService
        .quote(cartCode, trimmedZip)
        .then((result) => {
          if (cancelled) return;
          setQuote(result);
          setError(null);
        })
        .catch(() => {
          if (cancelled) return;
          setQuote(null);
          setError("No pudimos calcular el envío a ese código postal.");
        })
        .finally(() => {
          if (!cancelled) setIsQuoting(false);
        });
    }, debounceMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled, cartCode, zip, version, debounceMs, shippingService]);

  return { quote, isQuoting, error };
}