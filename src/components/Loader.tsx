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
