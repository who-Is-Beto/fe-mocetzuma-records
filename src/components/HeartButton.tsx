import { useState, type MouseEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../app/providers/AuthProvider";
import { useWishlist } from "../app/providers/WishlistProvider";

type HeartButtonProps = {
  recordId: number | string;
  /** Record title, for the spoken label and the toast. */
  title: string;
  /**
   * "overlay": round glass button floating on a cover (cards, carousel).
   * "inline": pill with a label, next to the buy button (record detail).
   */
  variant?: "overlay" | "inline";
  className?: string;
};

function HeartIcon({ filled, className }: { filled: boolean; className: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M12 20.5s-7.5-4.6-9.3-9.2C1.6 8.4 3.4 5 6.8 5c2 0 3.6 1.1 5.2 3 1.6-1.9 3.2-3 5.2-3 3.4 0 5.2 3.4 4.1 6.3-1.8 4.6-9.3 9.2-9.3 9.2z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Save / unsave a record in the user's favorites. Works inside a card link
 * (the click never opens the card). Logged out, it sends the visitor to log
 * in and brings them back here. The heart pops and a ring bursts on save.
 */
export function HeartButton({ recordId, title, variant = "overlay", className = "" }: HeartButtonProps) {
  const { isAuthenticated } = useAuth();
  const { isSaved, toggle } = useWishlist();
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const saved = isAuthenticated && isSaved(recordId);

  const onClick = async (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isAuthenticated) {
      navigate("/login", { state: { from: location } });
      return;
    }
    if (busy) return;
    setBusy(true);
    await toggle(recordId, title);
    setBusy(false);
  };

  const label = !isAuthenticated
    ? `Inicia sesión para guardar «${title}» en favoritos`
    : saved
    ? `Quitar «${title}» de favoritos`
    : `Guardar «${title}» en favoritos`;

  // Remounted on every change so the pop + burst replay.
  const heart = (
    <span key={saved ? "on" : "off"} className={`relative flex items-center justify-center ${saved ? "success-pop" : ""}`}>
      {saved ? (
        <span aria-hidden="true" className="success-ring absolute inset-[-6px] rounded-full border-2 border-coral opacity-0" />
      ) : null}
      <HeartIcon filled={saved} className={variant === "overlay" ? "h-5 w-5" : "h-[18px] w-[18px]"} />
    </span>
  );

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={saved}
        aria-label={label}
        title={label}
        disabled={busy}
        className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-pill border px-5 text-sm font-semibold transition duration-300 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange disabled:cursor-wait ${
          saved
            ? "border-coral/40 bg-coral/10 text-coral"
            : "border-navy/15 bg-cream text-navy hover:border-coral/60 hover:text-coral"
        } ${className}`}
      >
        {heart}
        <span>{saved ? "En favoritos" : "Guardar"}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={label}
      title={label}
      disabled={busy}
      className={`flex h-11 w-11 items-center justify-center rounded-full shadow-card ring-1 transition duration-300 hover:scale-110 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange disabled:cursor-wait ${
        saved ? "bg-white text-coral ring-coral/30" : "bg-white/90 text-navy ring-navy/10 hover:text-coral"
      } ${className}`}
    >
      {heart}
    </button>
  );
}
