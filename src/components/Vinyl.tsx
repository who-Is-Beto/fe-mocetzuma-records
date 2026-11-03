/** Charcoal vinyl (grooves + serape label), spinning slowly. Sizes to its box. */
export function Vinyl() {
  return (
    <div
      className="relative h-full w-full animate-[spin_14s_linear_infinite] rounded-full shadow-[0_20px_40px_-18px_rgba(0,0,0,0.6)] motion-reduce:animate-none"
      style={{
        backgroundImage:
          "repeating-radial-gradient(circle at center, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 2px, transparent 4px), linear-gradient(135deg, #1b1f2a, #262b38 55%, #000)"
      }}
    >
      <div className="absolute inset-[9%] rounded-full border border-white/10" />
      <div
        className="absolute left-1/2 top-1/2 h-[34%] w-[34%] -translate-x-1/2 -translate-y-1/2 rounded-full ring-4 ring-white/10"
        style={{
          background:
            "repeating-conic-gradient(from 0deg, #f8d15a 0deg 30deg, #f4903c 30deg 60deg, #e85f3c 60deg 90deg, #e4007c 90deg 120deg)"
        }}
      >
        <span className="absolute left-1/2 top-1/2 h-[14%] w-[14%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cream" />
      </div>
      {/* Light catching the grooves */}
      <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_200deg,transparent_0deg,rgba(255,255,255,0.10)_40deg,transparent_80deg,transparent_200deg,rgba(255,255,255,0.07)_240deg,transparent_280deg)]" />
    </div>
  );
}
