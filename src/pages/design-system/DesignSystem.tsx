type Swatch = {
  name: string;
  value: string;
  usage: string;
};

const palette: Swatch[] = [
  { name: "Navy", value: "#0f3f67", usage: "Text, nav, buttons" },
  { name: "Denim", value: "#14507a", usage: "Borders, icons" },
  { name: "Sand", value: "#f3e6c9", usage: "Base background" },
  { name: "Cream", value: "#fff6e1", usage: "Cards, surfaces" },
  { name: "Sun", value: "#f8d15a", usage: "Highlights, badges" },
  { name: "Amber", value: "#f5b13c", usage: "Secondary CTA" },
  { name: "Orange", value: "#f4903c", usage: "Primary CTA" },
  { name: "Coral", value: "#e85f3c", usage: "Alerts, emphasis" },
  { name: "Charcoal", value: "#1b1f2a", usage: "Vinyl grooves, text" }
];

const controls = [
  { label: "Listening", icon: "🎧", tone: "navy" },
  { label: "Add to bag", icon: "🎁", tone: "orange" },
  { label: "Wishlist", icon: "💛", tone: "sun" }
];

const infoLines = ["Description", "Tech specs", "Reviews", "Track list"];

const Pill = ({ label }: { label: string }) => (
  <span className="rounded-pill border border-navy/10 bg-white/70 px-4 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-navy/80 shadow-sm">
    {label}
  </span>
);

const SwatchCard = ({ swatch }: { swatch: Swatch }) => (
  <div className="flex items-center gap-3 rounded-xl border border-navy/10 bg-white/70 p-3 shadow-sm backdrop-blur">
    <div
      className="h-12 w-12 rounded-lg shadow-inner"
      style={{ backgroundColor: swatch.value }}
      aria-hidden
    />
    <div>
      <p className="text-sm font-semibold text-navy">{swatch.name}</p>
      <p className="text-xs text-navy/70">{swatch.usage}</p>
      <p className="text-[11px] font-mono uppercase tracking-[0.08em] text-navy/60">
        {swatch.value}
      </p>
    </div>
  </div>
);

const ActionButton = ({
  label,
  tone,
  icon
}: {
  label: string;
  tone: "navy" | "orange" | "sun";
  icon: string;
}) => {
  const toneMap: Record<"navy" | "orange" | "sun", string> = {
    navy: "bg-navy text-cream hover:bg-denim",
    orange: "bg-orange text-charcoal hover:bg-amber",
    sun: "bg-sun text-charcoal hover:bg-amber"
  };
  return (
    <button
      className={`flex items-center justify-center gap-2 rounded-pill px-5 py-3 text-sm font-semibold shadow-panel transition duration-200 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-navy ${toneMap[tone]}`}
    >
      <span>{icon}</span>
      {label}
    </button>
  );
};

const VinylBadge = () => (
  <div className="flex items-center gap-3 rounded-2xl border border-navy/10 bg-cream px-4 py-3 shadow-card">
    <div className="relative h-16 w-16 shrink-0">
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-charcoal via-neutral-800 to-black shadow-inner" />
      <div className="absolute inset-3 rounded-full border border-white/10" />
      <div className="absolute inset-6 rounded-full border border-white/30 bg-white/5 shadow-inner" />
    </div>
    <div>
      <p className="text-xs uppercase tracking-[0.2em] text-orange">Label</p>
      <p className="font-display text-xl text-denim">BADA BOOM</p>
      <p className="text-xs text-navy/70">Limited vinyl drops</p>
    </div>
  </div>
);

export function DesignSystemPage() {
  return (
    <>
      <header
        id="design-system"
        className="flex flex-col gap-6 rounded-[28px] border border-navy/10 bg-cream/70 px-6 py-6 shadow-panel backdrop-blur-md md:flex-row md:items-end md:justify-between md:px-8"
      >
        <div className="space-y-4">
          <p className="text-xs uppercase tracking-[0.26em] text-orange">
            Vinyl commerce design system
          </p>
          <div className="space-y-2">
            <h1 className="font-display text-4xl text-denim md:text-5xl">
              EverBriit · Bada Boom
            </h1>
            <p className="max-w-2xl text-base text-navy/80">
              Retro-inspired UI language built for vinyl shopping: bold
              typography, warm gradient ribbons, and tactile cards that echo the
              groove of a record.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Pill label="Retro loud" />
            <Pill label="Tactile UI" />
            <Pill label="Mobile first" />
            <Pill label="Warm palette" />
          </div>
        </div>
        <VinylBadge />
      </header>

      <section id="patterns" className="grid gap-6 md:grid-cols-2">
        <div className="rounded-[24px] border border-navy/10 bg-cream/80 p-6 shadow-card backdrop-blur">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl text-denim">Colors</h2>
            <span className="rounded-pill bg-navy px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-cream">
              Groove palette
            </span>
          </div>
          <p className="mt-2 text-sm text-navy/70">
            Warm oranges and suns drive calls-to-action. Deep navy anchors
            typography and navigation, while sand/cream keep surfaces soft.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {palette.map((swatch) => (
              <SwatchCard key={swatch.name} swatch={swatch} />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-[24px] border border-navy/10 bg-cream/80 p-6 shadow-card backdrop-blur">
            <h2 className="font-display text-xl text-denim">Typography</h2>
            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-orange/20 bg-white/80 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-orange">
                  Display
                </p>
                <p className="font-display text-3xl text-denim">
                  It ain&apos;t no joke when you lose your vinyl
                </p>
                <p className="text-xs text-navy/70">
                  Krona One · Tight tracking for headlines.
                </p>
              </div>
              <div className="rounded-xl border border-navy/10 bg-white/80 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-orange">
                  Body
                </p>
                <p className="font-body text-base text-navy">
                  Work Sans keeps copy legible for listings, reviews, and
                  metadata.
                </p>
                <p className="text-xs text-navy/70">
                  Weights: 400 / 500 / 600.
                </p>
              </div>
              <div className="rounded-xl border border-navy/10 bg-white/80 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-orange">
                  Labels
                </p>
                <div className="flex flex-wrap gap-3 text-sm font-semibold text-navy">
                  <span className="rounded-pill bg-sun px-3 py-1">
                    Badge · sun
                  </span>
                  <span className="rounded-pill bg-orange px-3 py-1 text-charcoal">
                    CTA · orange
                  </span>
                  <span className="rounded-pill border border-navy/10 px-3 py-1">
                    Outline · navy
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-navy/10 bg-cream/80 p-6 shadow-card backdrop-blur">
            <h2 className="font-display text-xl text-denim">Spacing & shape</h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-navy/10 bg-white/80 p-4 text-sm text-navy">
                <p className="text-xs uppercase tracking-[0.12em] text-orange">
                  Radii
                </p>
                <p>Cards · 24px</p>
                <p>Pills · 999px</p>
                <p>Buttons · 14px</p>
              </div>
              <div className="rounded-xl border border-navy/10 bg-white/80 p-4 text-sm text-navy">
                <p className="text-xs uppercase tracking-[0.12em] text-orange">
                  Elevation
                </p>
                <p>Panel · 0 20px 60px 18% navy</p>
                <p>Cards · 0 10px 30px 14% black</p>
                <p>Buttons lift 2px on hover.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="components" className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-[24px] border border-navy/10 bg-cream/80 p-6 shadow-card backdrop-blur">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-xl text-denim">Buttons</h3>
            <span className="text-xs uppercase tracking-[0.16em] text-orange">
              States
            </span>
          </div>
          <div className="mt-4 grid gap-3">
            <ActionButton icon="▶️" label="Play preview" tone="navy" />
            <ActionButton icon="🛍️" label="Add to bag" tone="orange" />
            <ActionButton icon="⭐️" label="Wishlist" tone="sun" />
          </div>
          <p className="mt-3 text-xs text-navy/70">
            CTAs are pill-shaped, high contrast, and use subtle elevation to
            stay tactile.
          </p>
        </div>

        <div className="rounded-[24px] border border-navy/10 bg-cream/80 p-6 shadow-card backdrop-blur">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-xl text-denim">Chips & Inputs</h3>
            <span className="text-xs uppercase tracking-[0.16em] text-orange">
              Filters
            </span>
          </div>
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              {["On sale", "New drops", "FLAC", "Vinyl only"].map((chip) => (
                <button
                  key={chip}
                  className="rounded-pill border border-orange/50 bg-white/80 px-4 py-2 text-sm font-semibold text-navy shadow-sm transition hover:-translate-y-0.5 hover:border-orange hover:bg-sun/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange"
                >
                  {chip}
                </button>
              ))}
            </div>
            <div className="space-y-2 rounded-2xl border border-navy/10 bg-white/80 p-4 shadow-inner">
              <label className="text-xs uppercase tracking-[0.16em] text-orange">
                Search
              </label>
              <div className="flex items-center gap-3 rounded-xl border border-navy/20 bg-cream px-3 py-2 focus-within:border-orange">
                <span className="text-lg">🔎</span>
                <input
                  className="w-full bg-transparent text-sm text-navy placeholder:text-navy/50 focus:outline-none"
                  placeholder="Find your next record..."
                />
                <span className="rounded-pill bg-navy px-3 py-1 text-xs font-semibold text-cream">
                  ↵ Enter
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-navy/10 bg-cream/80 p-6 shadow-card backdrop-blur">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-xl text-denim">Icon bar</h3>
            <span className="text-xs uppercase tracking-[0.16em] text-orange">
              Navigation
            </span>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-3">
            {["🏠", "❤️", "🔎", "🛍️"].map((icon) => (
              <button
                key={icon}
                className="flex h-14 items-center justify-center rounded-2xl border border-navy/10 bg-white/80 text-2xl text-denim shadow-sm transition hover:-translate-y-0.5 hover:border-orange"
              >
                {icon}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-navy/70">
            Rounded squares mirror the phone mock navigation in the reference
            shot.
          </p>
        </div>
      </section>

      <section className="rounded-[28px] border border-navy/10 bg-cream/90 p-6 shadow-panel backdrop-blur lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-orange">
              Component example
            </p>
            <h3 className="font-display text-2xl text-denim">
              Product detail layout
            </h3>
            <p className="text-sm text-navy/70">
              Blends the hero gradient ribbon, vinyl art, CTA bar, and accordion
              lines.
            </p>
          </div>
          <div className="flex gap-2 rounded-pill border border-navy/10 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-navy shadow-sm">
            <span>Handheld first</span>
            <span className="text-orange">·</span>
            <span>Edge-to-edge</span>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="relative overflow-hidden rounded-[26px] border border-navy/10 bg-cream shadow-card">
            <div className="absolute inset-x-0 top-0 h-28 bg-stripes" />
            <div className="relative p-6">
              <div className="flex items-start gap-4">
                <div className="relative h-28 w-28 shrink-0">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-charcoal via-neutral-800 to-black shadow-inner" />
                  <div className="absolute inset-3 rounded-full border border-white/20" />
                  <div className="absolute inset-6 rounded-full border border-white/40 bg-white/5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm uppercase tracking-[0.18em] text-orange">
                    Vinyl on sale
                  </p>
                  <h4 className="font-display text-2xl text-denim">Rumours</h4>
                  <p className="text-sm text-navy/70">
                    Fleetwood Mac · FLAC audio with vinyl vibe
                  </p>
                </div>
                <div className="ml-auto rounded-2xl bg-white/90 px-3 py-2 text-sm font-semibold text-navy shadow-inner">
                  $14.99
                </div>
              </div>

              <div className="mt-5 flex items-center gap-3">
                <div className="flex items-center gap-2 rounded-pill bg-navy px-4 py-2 text-sm font-semibold text-cream shadow-panel">
                  Listening <span>🎵</span>
                </div>
                <span className="text-xs text-navy/70">
                  (with vinyl sound effect)
                </span>
              </div>

              <div className="mt-5 space-y-3">
                {infoLines.map((line) => (
                  <div
                    key={line}
                    className="flex items-center justify-between border-b border-orange/60 pb-2 text-sm font-semibold text-navy"
                  >
                    {line}
                    <span>➜</span>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                {controls.map((action) => (
                  <ActionButton
                    key={action.label}
                    icon={action.icon}
                    label={action.label}
                    tone={
                      action.tone === "orange"
                        ? "orange"
                        : action.tone === "sun"
                        ? "sun"
                        : "navy"
                    }
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-[26px] border border-navy/10 bg-cream p-5 shadow-card">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-orange text-lg font-semibold text-charcoal shadow-inner">
                ★
              </span>
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-orange">
                  Micro patterns
                </p>
                <p className="font-semibold text-denim">
                  Use gradient ribbons for emphasis
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-navy/10 bg-white/80 p-4 text-sm text-navy">
              <p className="font-semibold text-denim">Spacing</p>
              <p className="text-navy/70">
                24px padding on cards, 16px gutters, 12px pill padding. Keep nav
                icons in a 56px square with 14px radius.
              </p>
            </div>
            <div className="rounded-2xl border border-orange/20 bg-sun/40 p-4 text-sm text-navy">
              <p className="font-semibold text-denim">Tone</p>
              <p className="text-navy/80">
                Celebrate bold copy, short lines, and playful emojis. Contrast
                stays high with navy on warm backdrops.
              </p>
            </div>
            <div className="rounded-2xl border border-navy/10 bg-white/90 p-4 text-sm text-navy">
              <p className="font-semibold text-denim">Motion</p>
              <p className="text-navy/70">
                Buttons lift 2px with easing; cards fade-in over 200ms. Avoid
                heavy blurs on small screens.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export default DesignSystemPage;
