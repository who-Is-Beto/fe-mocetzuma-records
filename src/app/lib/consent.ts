import { useSyncExternalStore } from "react";

/**
 * Cookie / storage consent. The choice itself lives in localStorage (storing
 * it is what the law allows without consent, so we never ask twice).
 *
 * Always on, whatever the choice — the site can't work without them:
 *   - moctezuma-session (login) and moctezuma-cart-code (cart), localStorage
 *   - this consent record
 *
 * Only after "Aceptar" (none of it is written or loaded after "Rechazar"):
 *   - preferences and caches: catalog page size, last maintenance status,
 *     record-detail cache (sessionStorage)
 *   - Cloudflare Web Analytics (loaded by the app, see loadAnalytics)
 *   - images on third-party hosts we don't proxy (lib/image.ts): after
 *     "Rechazar" they become a placeholder. Discogs and the other common
 *     hosts come through our domain, so they always load, cookie-free.
 */
export type ConsentChoice = "accepted" | "rejected";

const CONSENT_KEY = "moctezuma-cookie-consent";
const CHANGE_EVENT = "moctezuma-consent-change";
/** Bump when what we ask consent for changes: everyone is asked again. */
const CONSENT_VERSION = 1;

/** Non-essential keys, removed the moment someone rejects. */
const OPTIONAL_LOCAL_KEYS = ["moctezuma-catalog-page-size", "moctezuma-maintenance-active"];
const OPTIONAL_SESSION_PREFIXES = ["record-detail:"];

export function getConsent(): ConsentChoice | null {
  try {
    const stored = JSON.parse(localStorage.getItem(CONSENT_KEY) ?? "null") as
      | { choice: ConsentChoice; version: number }
      | null;
    return stored && stored.version === CONSENT_VERSION ? stored.choice : null;
  } catch {
    return null;
  }
}

/** True only after an explicit "Aceptar". */
export const canUseOptionalStorage = () => getConsent() === "accepted";

export function setConsent(choice: ConsentChoice) {
  try {
    localStorage.setItem(
      CONSENT_KEY,
      JSON.stringify({ choice, version: CONSENT_VERSION, date: new Date().toISOString() })
    );
  } catch {
    // storage blocked: the banner simply shows again next visit
  }
  if (choice === "rejected") clearOptionalStorage();
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Forget the choice so the banner asks again (footer "Preferencias de cookies"). */
export function resetConsent() {
  try {
    localStorage.removeItem(CONSENT_KEY);
  } catch {
    // nothing stored
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function clearOptionalStorage() {
  try {
    OPTIONAL_LOCAL_KEYS.forEach((key) => localStorage.removeItem(key));
    Object.keys(sessionStorage)
      .filter((key) => OPTIONAL_SESSION_PREFIXES.some((prefix) => key.startsWith(prefix)))
      .forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // storage blocked: nothing was stored either
  }
}

const subscribe = (onChange: () => void) => {
  window.addEventListener(CHANGE_EVENT, onChange);
  // Another tab decided: follow it.
  const onStorage = (event: StorageEvent) => event.key === CONSENT_KEY && onChange();
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
};

/** The current choice (null = not decided yet), re-rendering when it changes. */
export function useConsent(): ConsentChoice | null {
  return useSyncExternalStore(subscribe, getConsent, () => null);
}

/* ── Analytics ───────────────────────────────────────────────────────── */

const BEACON_TOKEN = import.meta.env.VITE_CF_BEACON_TOKEN as string | undefined;
let analyticsLoaded = false;

/**
 * Cloudflare Web Analytics, only after "Aceptar". Needs VITE_CF_BEACON_TOKEN
 * and Cloudflare's automatic injection turned off (otherwise Cloudflare adds
 * the beacon to every page itself, consent or not).
 */
export function loadAnalytics() {
  if (analyticsLoaded || !BEACON_TOKEN || !canUseOptionalStorage()) return;
  analyticsLoaded = true;
  const script = document.createElement("script");
  script.defer = true;
  script.src = "https://static.cloudflareinsights.com/beacon.min.js";
  script.dataset.cfBeacon = JSON.stringify({ token: BEACON_TOKEN, spa: true });
  document.body.appendChild(script);
}

/* ── Third-party images ──────────────────────────────────────────────── */

/** Hosts we serve images from ourselves (no third-party cookies). */
const FIRST_PARTY_IMAGE_HOSTS = new Set([
  "moctezumarecords.com",
  "api.moctezumarecords.com",
  "pub-68b3bb8285924e24851b40086d6cc375.r2.dev",
]);

/** Would loading this image let a third party set cookies? */
export function isThirdPartyImage(src: string): boolean {
  try {
    const url = new URL(src, window.location.href);
    if (url.origin === window.location.origin || url.protocol === "data:" || url.protocol === "blob:") return false;
    return !FIRST_PARTY_IMAGE_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}
