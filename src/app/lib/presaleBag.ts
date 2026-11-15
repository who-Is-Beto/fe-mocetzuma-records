import { useSyncExternalStore } from "react";
import type { Presale, PresaleOption } from "../domain/presales";

/**
 * Versions picked on other presale pages, so several presales go in one order
 * (one box, one payment). Kept in localStorage; prices and stock are re-checked
 * by the server when reserving. Cleared once the reservation opens Stripe.
 */
export type BagPresale = Pick<Presale, "slug" | "title" | "artist" | "cover">;
export type BagLine = { presale: BagPresale; option: PresaleOption; quantity: number };

const KEY = "moctezuma-presale-bag";
const listeners = new Set<() => void>();
let cache: { raw: string | null; lines: BagLine[] } = { raw: null, lines: [] };

function read(): BagLine[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return cache.lines;
  }
  if (raw !== cache.raw) {
    let lines: BagLine[] = [];
    try {
      lines = raw ? (JSON.parse(raw) as BagLine[]) : [];
    } catch {
      lines = [];
    }
    cache = { raw, lines: Array.isArray(lines) ? lines : [] };
  }
  return cache.lines;
}

function write(lines: BagLine[]) {
  try {
    if (lines.length) window.localStorage.setItem(KEY, JSON.stringify(lines));
    else window.localStorage.removeItem(KEY);
  } catch {
    // Private mode / storage blocked: the bag just doesn't persist.
    cache = { raw: null, lines };
  }
  listeners.forEach((l) => l());
}

/** Replace this presale's lines in the bag (an empty list removes the presale). */
export function setPresaleLines(presale: BagPresale, lines: { option: PresaleOption; quantity: number }[]) {
  const others = read().filter((l) => l.presale.slug !== presale.slug);
  write([...others, ...lines.filter((l) => l.quantity > 0).map((l) => ({ presale, option: l.option, quantity: l.quantity }))]);
}

export function removePresale(slug: string) {
  write(read().filter((l) => l.presale.slug !== slug));
}

export function clearBag() {
  write([]);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => e.key === KEY && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function usePresaleBag(): BagLine[] {
  return useSyncExternalStore(subscribe, read, () => []);
}
