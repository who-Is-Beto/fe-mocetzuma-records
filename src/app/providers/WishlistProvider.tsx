import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Toast } from "../../components/Toast";
import { createWishlistService } from "../services/wishlistService";
import { useAuth } from "./AuthProvider";

type WishlistValue = {
  /** Ids of the records the user saved (empty when logged out). */
  savedIds: ReadonlySet<number>;
  count: number;
  isSaved(recordId: number | string): boolean;
  /**
   * Save or unsave. Updates instantly and syncs in the background; if the
   * server refuses, the heart flips back and a toast explains it.
   * Resolves to the new state. Callers check `isAuthenticated` first.
   */
  toggle(recordId: number | string, title?: string): Promise<boolean>;
  /** Bumps on every successful toggle: lets the navbar badge animate. */
  changes: number;
};

const WishlistContext = createContext<WishlistValue | null>(null);

/**
 * The logged-in user's saved record ids, shared by every heart on screen
 * (catalog cards, home, record detail, navbar badge, /favoritos).
 */
export function WishlistProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const service = useMemo(() => createWishlistService({ getToken: () => token ?? null }), [token]);
  const [savedIds, setSavedIds] = useState<ReadonlySet<number>>(new Set());
  const [changes, setChanges] = useState(0);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);

  // Load on login, forget on logout.
  useEffect(() => {
    let cancelled = false;
    const load = token ? service.ids() : Promise.resolve<number[]>([]);
    load
      .then((ids) => !cancelled && setSavedIds(new Set(ids)))
      .catch(() => !cancelled && setSavedIds(new Set()));
    return () => {
      cancelled = true;
    };
  }, [service, token]);

  const isSaved = useCallback((recordId: number | string) => savedIds.has(Number(recordId)), [savedIds]);

  const toggle = useCallback(
    async (recordId: number | string, title?: string) => {
      const id = Number(recordId);
      const willSave = !savedIds.has(id);
      const apply = (save: boolean) =>
        setSavedIds((current) => {
          const next = new Set(current);
          if (save) next.add(id);
          else next.delete(id);
          return next;
        });

      apply(willSave);
      try {
        await (willSave ? service.add(id) : service.remove(id));
        setChanges((n) => n + 1);
        setToast({
          message: willSave
            ? `${title ? `«${title}»` : "El disco"} se guardó en tus favoritos`
            : `${title ? `«${title}»` : "El disco"} salió de tus favoritos`,
          tone: "success"
        });
        return willSave;
      } catch {
        apply(!willSave);
        setToast({ message: "No pudimos actualizar tus favoritos. Intenta de nuevo.", tone: "error" });
        return !willSave;
      }
    },
    [savedIds, service]
  );

  const value = useMemo(
    () => ({ savedIds, count: savedIds.size, isSaved, toggle, changes }),
    [savedIds, isSaved, toggle, changes]
  );

  return (
    <WishlistContext.Provider value={value}>
      {children}
      {toast ? <Toast key={`${toast.message}-${changes}`} message={toast.message} tone={toast.tone} onClose={() => setToast(null)} /> : null}
    </WishlistContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWishlist(): WishlistValue {
  const value = useContext(WishlistContext);
  if (!value) throw new Error("useWishlist must be used inside <WishlistProvider>");
  return value;
}
