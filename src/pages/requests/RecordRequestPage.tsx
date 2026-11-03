import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "../../components/Button";
import { Img } from "../../components/Img";
import { Skeleton } from "../../components/Skeleton";
import { SuccessCheck } from "../../components/SuccessCheck";
import { secondaryCta } from "../../components/cta";
import { useAuth } from "../../app/providers/AuthProvider";
import { useSeo } from "../../app/hooks/useSeo";
import { HttpError } from "../../app/lib/httpClient";
import { createRecordService } from "../../app/services/recordService";
import { createRecordRequestService } from "../../app/services/recordRequestService";
import type { DiscogsAlbum, RecordRequest } from "../../app/domain/recordRequest";
import { DiscogsPicker } from "./DiscogsPicker";

const ANY_FORMAT = "Cualquiera";
const FALLBACK_FORMATS = ["LP", '7"', "CD", "Casete"];
const MESSAGE_MAX = 2000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Fields = Required<Pick<RecordRequest, "name" | "email" | "artist" | "title" | "format" | "details" | "message">>;
type Errors = Partial<Record<keyof Fields, string>>;

const STEPS = [
  { title: "Cuéntanos qué buscas", text: "Artista, disco y, si quieres, la edición exacta." },
  { title: "Lo buscamos por ti", text: "Revisamos proveedores, coleccionistas y bazares." },
  { title: "Te escribimos", text: "Te mandamos precio y condición antes de apartarlo." }
];

/** `albumFormats`: when a record was picked, the format must be one it came out in. */
function validate(fields: Fields, albumFormats: string[] | null = null): Errors {
  const errors: Errors = {};
  if (!fields.artist.trim()) errors.artist = "Dinos el artista o banda.";
  if (!fields.title.trim()) errors.title = "Dinos qué disco buscas.";
  if (albumFormats && !albumFormats.includes(fields.format)) errors.format = "Elige en qué formato lo quieres.";
  if (!fields.name.trim()) errors.name = "¿Cómo te llamas?";
  if (!EMAIL_RE.test(fields.email.trim())) errors.email = "Revisa tu correo: ahí te contestamos.";
  return errors;
}

function Field({
  label,
  optional,
  error,
  hint,
  children,
  id
}: {
  label: string;
  optional?: boolean;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
  id: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="flex items-baseline justify-between gap-2 text-sm font-semibold text-navy">
        {label}
        {optional ? <span className="text-xs font-medium text-navy/50">Opcional</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="flex items-center gap-1.5 text-xs font-semibold text-coral">
          <span aria-hidden="true">⚠</span>
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-navy/55">{hint}</p>
      ) : null}
    </div>
  );
}

const inputClass = (invalid: boolean) =>
  `w-full rounded-xl border bg-cream px-3.5 text-base text-navy shadow-inner outline-none transition placeholder:text-navy/40 focus:ring-4 sm:text-sm ${
    invalid ? "border-coral focus:border-coral focus:ring-coral/15" : "border-navy/15 focus:border-orange focus:ring-orange/15"
  }`;

/**
 * /encargar: ask the store to find a record. Emailed to the store with
 * Reply-To the visitor; logged-in users get name and email prefilled.
 * ?artist= / ?title= prefill it (from "not found" pages and empty searches).
 */
export function RecordRequestPage() {
  useSeo({
    title: "Encargar un disco",
    description: "¿Buscas un vinilo que no está en el catálogo? Cuéntanos cuál y te lo buscamos en Moctezuma Records."
  });
  const [params] = useSearchParams();
  const { user, token } = useAuth();
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;

  const initial = (): Fields => ({
    name: user?.name ?? "",
    email: user?.email ?? "",
    artist: params.get("artist") ?? "",
    title: params.get("title") ?? "",
    format: ANY_FORMAT,
    details: "",
    message: ""
  });
  const [fields, setFields] = useState<Fields>(initial);
  const [website, setWebsite] = useState("");
  // Field errors from the server (400); client checks are derived below.
  const [serverErrors, setServerErrors] = useState<Errors>({});
  // A field shows its problem once the visitor has left it.
  const [touched, setTouched] = useState<Partial<Record<keyof Fields, boolean>>>({});
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState<Fields | null>(null);
  const [formats, setFormats] = useState<string[]>(FALLBACK_FORMATS);
  const [discogs, setDiscogs] = useState<DiscogsAlbum | null>(null);
  const [sentAlbum, setSentAlbum] = useState<DiscogsAlbum | null>(null);
  // Formats of the picked album: null = nothing picked (or lookup failed),
  // so the chips fall back to the store's formats.
  const [albumFormats, setAlbumFormats] = useState<string[] | "loading" | null>(null);
  const lookup = useRef(0);

  const recordService = useMemo(() => createRecordService({ getToken: () => token }), [token]);
  const requestService = useMemo(() => createRecordRequestService(), []);

  // The store's real formats (Administración → Formatos).
  useEffect(() => {
    let cancelled = false;
    recordService
      .getCategories()
      .then((list) => {
        const names = list.map((c) => c.name).filter(Boolean);
        if (!cancelled && names.length) setFormats(names);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [recordService]);

  // A picked record must be asked for in a format it really came out in
  // (no "Cualquiera"); while its formats load, nothing can be chosen yet.
  const pickedFormats = albumFormats === "loading" ? [] : albumFormats;
  const formatOptions = pickedFormats ?? [ANY_FORMAT, ...formats];

  // Picking a Discogs result fills artist and title (still editable) and
  // narrows the format chips to the ones that record really came out in.
  const pickDiscogs = (album: DiscogsAlbum | null) => {
    setDiscogs(album);
    const ticket = ++lookup.current; // a newer pick wins over a slow lookup
    const next = album
      ? { ...fields, artist: album.artist || fields.artist, title: album.title || fields.title, format: "" }
      : { ...fields, format: ANY_FORMAT };
    setFields(next);
    if (!album) {
      setAlbumFormats(null);
      return;
    }
    setAlbumFormats("loading");
    // Lookup failed or found nothing: back to the store's formats.
    const fallBack = () => {
      if (ticket !== lookup.current) return;
      setAlbumFormats(null);
      setFields((current) => ({ ...current, format: ANY_FORMAT }));
    };
    requestService
      .discogsFormats(album)
      .then((list) => {
        if (ticket !== lookup.current) return;
        if (!list.length) return fallBack();
        setAlbumFormats(list);
        // Only one format exists: nothing to choose.
        if (list.length === 1) setFields((current) => ({ ...current, format: list[0] }));
      })
      .catch(fallBack);
  };

  const set = (key: keyof Fields) => (value: string) => {
    setFields({ ...fields, [key]: value });
    if (serverErrors[key]) setServerErrors({ ...serverErrors, [key]: undefined });
  };
  const touch = (key: keyof Fields) => () => setTouched((t) => (t[key] ? t : { ...t, [key]: true }));

  // The send button stays off until every mandatory field is right.
  const problems = validate(fields, pickedFormats);
  const canSend = Object.keys(problems).length === 0 && albumFormats !== "loading";
  const errors: Errors = {};
  for (const key of Object.keys(problems) as (keyof Fields)[]) if (touched[key]) errors[key] = problems[key];
  Object.assign(errors, Object.fromEntries(Object.entries(serverErrors).filter(([, v]) => v)));
  const MISSING_LABELS: Partial<Record<keyof Fields, string>> = {
    artist: "el artista",
    title: "el disco",
    format: "el formato",
    name: "tu nombre",
    email: "un correo válido"
  };
  const missing = (Object.keys(problems) as (keyof Fields)[]).map((key) => MISSING_LABELS[key]).filter(Boolean);
  const missingText =
    missing.length > 1 ? `${missing.slice(0, -1).join(", ")} y ${missing[missing.length - 1]}` : missing[0] ?? "";

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (!canSend) {
      // Enter in a field while something is missing: point at the first gap.
      setTouched(Object.fromEntries(Object.keys(problems).map((k) => [k, true])));
      const first = Object.keys(problems)[0];
      if (first) document.getElementById(id(first))?.focus();
      return;
    }
    setSending(true);
    try {
      await requestService.send({
        ...fields,
        format: fields.format === ANY_FORMAT ? "" : fields.format,
        year: discogs?.year ? Number(discogs.year) || null : null,
        discogs_url: discogs?.url ?? "",
        cover_url: discogs?.cover ?? discogs?.thumb ?? "",
        website
      });
      setSent(fields);
      setSentAlbum(discogs);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      if (error instanceof HttpError && error.status === 429) {
        setFormError("Ya recibimos varios encargos tuyos. Intenta de nuevo en una hora o escríbenos por Instagram.");
      } else if (error instanceof HttpError && error.status === 400) {
        const details = (error.data as { error?: { details?: Record<string, string[]> } })?.error?.details ?? {};
        setServerErrors(Object.fromEntries(Object.entries(details).map(([k, v]) => [k, v[0]])) as Errors);
        setFormError("Revisa los campos marcados.");
      } else {
        setFormError("No pudimos enviar tu encargo. Revisa tu conexión e intenta de nuevo.");
      }
    } finally {
      setSending(false);
    }
  };

  const reset = () => {
    setFields({ ...initial(), name: fields.name, email: fields.email, artist: "", title: "" });
    setSent(null);
    setDiscogs(null);
    setSentAlbum(null);
    setAlbumFormats(null);
    setTouched({});
    setServerErrors({});
  };

  const describedBy = (key: keyof Fields) => (errors[key] ? `${id(key)}-error` : undefined);

  return (
    <section className="grid gap-8 lg:grid-cols-[minmax(0,5fr),minmax(0,7fr)] lg:items-start lg:gap-12">
      {/* Intro */}
      <header className="lg:sticky lg:top-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange">Encargos</p>
        <h1 className="mt-2 font-display text-3xl leading-tight text-denim sm:text-4xl">¿Buscas un disco que no tenemos?</h1>
        <p className="mt-3 max-w-md text-[15px] leading-relaxed text-navy/75">
          Dinos cuál y lo buscamos por ti. Sin compromiso: te escribimos con precio y condición antes de apartar nada.
        </p>
        <ol className="mt-7 hidden space-y-4 sm:block">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-3.5">
              <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sun font-display text-sm text-navy">
                {index + 1}
              </span>
              <span>
                <span className="block text-sm font-semibold text-denim">{step.title}</span>
                <span className="block text-[13px] leading-relaxed text-navy/70">{step.text}</span>
              </span>
            </li>
          ))}
        </ol>
      </header>

      {/* Form / success */}
      <div className="relative overflow-hidden rounded-[28px] border border-navy/10 bg-white/85 p-5 shadow-panel sm:p-8">
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1.5 bg-stripes" />
        {sent ? (
          <div role="status" className="py-6 text-center">
            {sentAlbum?.cover || sentAlbum?.thumb ? (
              <div className="relative mx-auto h-24 w-24">
                <Img
                  src={(sentAlbum.cover ?? sentAlbum.thumb) as string}
                  alt=""
                  width={96}
                  className="sleeve-in h-24 w-24 rounded-xl object-cover shadow-card"
                />
                <span className="absolute -bottom-3 -right-3">
                  <SuccessCheck className="h-10 w-10" />
                </span>
              </div>
            ) : (
              <SuccessCheck className="mx-auto h-16 w-16" />
            )}
            <h2 className="mt-6 font-display text-2xl text-denim">¡Encargo enviado!</h2>
            <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-navy/75">
              Ya estamos buscando <strong className="text-navy">«{sent.title}»</strong> de {sent.artist}. Te escribiremos a{" "}
              <strong className="text-navy [overflow-wrap:anywhere]">{sent.email}</strong>.
            </p>
            <div className="mt-8 grid gap-3 min-[480px]:flex min-[480px]:justify-center">
              <Button tone="navy" className="min-h-[52px] px-7" onClick={reset}>
                Encargar otro disco
              </Button>
              <Link to="/catalogo" className={secondaryCta}>Ver catálogo</Link>
            </div>
          </div>
        ) : (
          <form noValidate onSubmit={onSubmit} className="space-y-6">
            <fieldset className="min-w-0 space-y-4">
              <legend className="mb-4 font-display text-lg text-denim">El disco</legend>
              <DiscogsPicker
                service={requestService}
                initialQuery={[params.get("artist"), params.get("title")].filter(Boolean).join(" ")}
                selected={discogs}
                onSelect={pickDiscogs}
                onSkip={() => document.getElementById(id("artist"))?.focus()}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id={id("artist")} label="Artista o banda" error={errors.artist}>
                  <input
                    id={id("artist")}
                    value={fields.artist}
                    onChange={(e) => set("artist")(e.target.value)}
                    onBlur={touch("artist")}
                    maxLength={120}
                    autoComplete="off"
                    placeholder="Ej. Los Ángeles Azules"
                    aria-invalid={Boolean(errors.artist)}
                    aria-describedby={describedBy("artist")}
                    className={`${inputClass(Boolean(errors.artist))} h-12`}
                  />
                </Field>
                <Field id={id("title")} label="Disco o álbum" error={errors.title}>
                  <input
                    id={id("title")}
                    value={fields.title}
                    onChange={(e) => set("title")(e.target.value)}
                    onBlur={touch("title")}
                    maxLength={160}
                    autoComplete="off"
                    placeholder="Ej. Inolvidable"
                    aria-invalid={Boolean(errors.title)}
                    aria-describedby={describedBy("title")}
                    className={`${inputClass(Boolean(errors.title))} h-12`}
                  />
                </Field>
              </div>

              <div
                id={id("format")}
                role="radiogroup"
                tabIndex={-1}
                aria-labelledby={id("format-label")}
                aria-invalid={Boolean(errors.format)}
                aria-describedby={describedBy("format")}
                className="space-y-2 outline-none"
              >
                <p id={id("format-label")} className="text-sm font-semibold text-navy">
                  Formato
                  {Array.isArray(albumFormats) ? (
                    <span className="ml-1.5 font-medium text-navy/55">· en los que salió este disco</span>
                  ) : null}
                </p>
                {albumFormats === "loading" ? (
                  <div className="flex flex-wrap gap-2" aria-label="Cargando formatos…">
                    {["w-28", "w-14", "w-12", "w-[4.5rem]"].map((w) => (
                      <Skeleton key={w} className={`h-10 rounded-pill ${w}`} />
                    ))}
                  </div>
                ) : (
                <div className="flex flex-wrap gap-2">
                  {formatOptions.map((format) => {
                    const checked = fields.format === format;
                    return (
                      <button
                        key={format}
                        type="button"
                        role="radio"
                        aria-checked={checked}
                        onClick={() => {
                          set("format")(format);
                          touch("format")();
                        }}
                        className={`min-h-[40px] rounded-pill border px-4 text-sm font-semibold transition active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange ${
                          checked
                            ? "border-navy bg-navy text-cream shadow-card"
                            : `bg-cream text-navy hover:border-orange/60 ${errors.format ? "border-coral/60" : "border-navy/15"}`
                        }`}
                      >
                        {format}
                      </button>
                    );
                  })}
                </div>
                )}
                {errors.format ? (
                  <p id={`${id("format")}-error`} className="flex items-center gap-1.5 text-xs font-semibold text-coral">
                    <span aria-hidden="true">⚠</span>
                    {errors.format}
                  </p>
                ) : null}
              </div>

              <Field id={id("details")} label="Detalles" optional hint="Edición, año, país, prensaje, color, condición mínima o presupuesto.">
                <input
                  id={id("details")}
                  value={fields.details}
                  onChange={(e) => set("details")(e.target.value)}
                  maxLength={300}
                  autoComplete="off"
                  placeholder="Ej. Primera edición de 1996, vinil de color"
                  className={`${inputClass(false)} h-12`}
                />
              </Field>

              <Field
                id={id("message")}
                label="Mensaje"
                optional
                hint={<span className="tabular-nums">{fields.message.length}/{MESSAGE_MAX}</span>}
              >
                <textarea
                  id={id("message")}
                  value={fields.message}
                  onChange={(e) => set("message")(e.target.value)}
                  maxLength={MESSAGE_MAX}
                  rows={4}
                  placeholder="¿Algo más que debamos saber? Ej. es para regalo y lo necesito antes del 24."
                  className={`${inputClass(false)} resize-y py-3 leading-relaxed`}
                />
              </Field>
            </fieldset>

            <div className="border-t border-navy/10 pt-6">
            <fieldset className="min-w-0 space-y-4">
              <legend className="mb-4 font-display text-lg text-denim">¿A dónde te escribimos?</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id={id("name")} label="Tu nombre" error={errors.name}>
                  <input
                    id={id("name")}
                    value={fields.name}
                    onChange={(e) => set("name")(e.target.value)}
                    onBlur={touch("name")}
                    maxLength={80}
                    autoComplete="name"
                    aria-invalid={Boolean(errors.name)}
                    aria-describedby={describedBy("name")}
                    className={`${inputClass(Boolean(errors.name))} h-12`}
                  />
                </Field>
                <Field id={id("email")} label="Tu correo" error={errors.email}>
                  <input
                    id={id("email")}
                    type="email"
                    inputMode="email"
                    value={fields.email}
                    onChange={(e) => set("email")(e.target.value)}
                    onBlur={touch("email")}
                    maxLength={254}
                    autoComplete="email"
                    autoCapitalize="off"
                    spellCheck={false}
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={describedBy("email")}
                    className={`${inputClass(Boolean(errors.email))} h-12`}
                  />
                </Field>
              </div>
            </fieldset>
            </div>

            {/* Honeypot: hidden from people and screen readers; bots fill it. */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
              <label>
                Sitio web
                <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </label>
            </div>

            {formError ? (
              <p role="alert" className="rounded-xl border border-coral/30 bg-coral/5 px-4 py-3 text-sm font-semibold text-coral">
                {formError}
              </p>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {canSend ? (
                <p className="text-xs leading-relaxed text-navy/60 sm:max-w-[16rem]">
                  Solo usamos tu correo para contestarte sobre este encargo.
                </p>
              ) : (
                <p id={id("missing")} aria-live="polite" className="flex items-start gap-1.5 text-xs font-semibold leading-relaxed text-navy/70 sm:max-w-[18rem]">
                  <span aria-hidden="true">✍️</span>
                  <span>
                    {albumFormats === "loading" ? "Cargando los formatos del disco…" : `Para enviar, falta ${missingText}.`}
                  </span>
                </p>
              )}
              <Button
                type="submit"
                tone="orange"
                loading={sending}
                disabled={!canSend}
                aria-describedby={canSend ? undefined : id("missing")}
                className="min-h-[52px] w-full px-7 sm:w-auto"
              >
                {sending ? "Enviando…" : "Enviar encargo"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

export default RecordRequestPage;
