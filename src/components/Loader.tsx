/** Small spinning record for buttons and inline busy states (sized by `className`). */
export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`relative inline-block shrink-0 animate-spin rounded-full ${className}`}>
      <span className="absolute inset-0 rounded-full bg-gradient-to-br from-charcoal via-neutral-800 to-black" />
      <span className="absolute inset-[18%] rounded-full border border-white/25" />
      <span className="absolute inset-[36%] rounded-full bg-orange" />
      <span className="absolute left-1/2 top-1/2 h-[12%] w-[12%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cream" />
    </span>
  )
}

export function Loader() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-navy/10 bg-cream/80 px-5 py-6 shadow-card">
      <div className="relative h-16 w-16 animate-spin">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-charcoal via-neutral-800 to-black shadow-inner" />
        <div className="absolute inset-2 rounded-full border border-white/10" />
        <div className="absolute inset-4 rounded-full border border-white/30" />
        <div className="absolute inset-6 flex items-center justify-center rounded-full bg-cream text-xs font-semibold text-navy">
          🜨
        </div>
      </div>
      <p className="text-sm font-semibold text-denim">Cargando...</p>
    </div>
  )
}

export default Loader
