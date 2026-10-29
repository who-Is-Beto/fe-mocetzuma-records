/** Animated success badge: the disc pops in, a ring ripples out and the check draws itself. */
export function SuccessCheck({ className = "h-16 w-16" }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`relative inline-flex shrink-0 ${className}`}>
      <span className="success-ring absolute inset-0 rounded-full bg-green-500 opacity-0" />
      <span className="success-pop relative flex h-full w-full items-center justify-center rounded-full bg-green-600 shadow-panel">
        <svg viewBox="0 0 24 24" className="h-1/2 w-1/2" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path className="check-draw" d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
    </span>
  );
}
