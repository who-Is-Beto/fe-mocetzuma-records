import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import type { Category, Owner } from "../../../app/domain/album";
import type { AdminPresale, PresaleOptionInput } from "../../../app/domain/presales";
import { currency } from "../../../app/lib/format";
import { extractErrorMessage } from "../../../app/lib/httpClient";
import { useAuth } from "../../../app/providers/AuthProvider";
import type { PresaleService } from "../../../app/services/presaleService";
import { createRecordService } from "../../../app/services/recordService";
import { btnGhost, btnPrimary, errorBox, input, label, panel } from "./ui";

type OptionRow = {
  key: string;
  id?: number;
  hasOrders: boolean;
  taken: number;
  name: string;
  category: string;
  price: string;
  min_deposit: string;
  full_payment_discount: string;
  copies: string;
  cost_price: string;
  owner: string;
  weight_grams: string;
  is_active: boolean;
};

const emptyRow = (): OptionRow => ({
  key: crypto.randomUUID(),
  hasOrders: false,
  taken: 0,
  name: "",
  category: "",
  price: "",
  min_deposit: "",
  full_payment_discount: "0",
  copies: "",
  cost_price: "",
  owner: "",
  weight_grams: "",
  is_active: true
});

const num = (v: string) => Number(v.replace(",", "."));

function rowProblems(row: OptionRow): string[] {
  const out: string[] = [];
  if (!row.name.trim()) out.push("nombre");
  const price = num(row.price);
  if (!(price > 0)) out.push("precio");
  const dep = num(row.min_deposit);
  if (!(dep > 0 && dep < price)) out.push("apartado menor al precio");
  const disc = num(row.full_payment_discount || "0");
  if (!(disc >= 0 && disc < price)) out.push("descuento menor al precio");
  const copies = Number(row.copies);
  if (!(Number.isInteger(copies) && copies >= Math.max(1, row.taken))) out.push(row.taken ? `copias (mínimo ${row.taken})` : "copias");
  return out;
}

const toInput = (row: OptionRow): PresaleOptionInput => ({
  name: row.name.trim(),
  price: row.price,
  min_deposit: row.min_deposit,
  full_payment_discount: row.full_payment_discount || "0",
  copies: Number(row.copies),
  cost_price: row.cost_price || "0",
  owner: row.owner ? Number(row.owner) : null,
  category: row.category ? Number(row.category) : null,
  weight_grams: row.weight_grams ? Number(row.weight_grams) : null,
  is_active: row.is_active
});

type Props = {
  service: PresaleService;
  presale?: AdminPresale;
  onCancel: () => void;
  onSaved: (presale: AdminPresale) => void;
};

/** Create or edit a presale and its versions. Prices lock once a version has buyers. */
export function PresaleForm({ service, presale, onCancel, onSaved }: Props) {
  const { token } = useAuth();
  const ids = useId();
  const recordService = useMemo(() => createRecordService({ getToken: () => token }), [token]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [title, setTitle] = useState(presale?.title ?? "");
  const [artist, setArtist] = useState(presale?.artist ?? "");
  const [description, setDescription] = useState(presale?.description ?? "");
  const [deadline, setDeadline] = useState(presale?.purchase_deadline ?? "");
  const [arrival, setArrival] = useState(presale?.estimated_arrival ?? "");
  const [cover, setCover] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(presale?.cover_url ?? null);
  const [rows, setRows] = useState<OptionRow[]>(
    presale
      ? presale.options.map((o) => ({
          key: String(o.id),
          id: o.id,
          hasOrders: o.has_orders,
          taken: o.taken,
          name: o.name,
          category: o.category ? String(o.category) : "",
          price: o.price,
          min_deposit: o.min_deposit,
          full_payment_discount: o.full_payment_discount,
          copies: String(o.copies),
          cost_price: o.cost_price,
          owner: o.owner ? String(o.owner) : "",
          weight_grams: o.weight_grams ? String(o.weight_grams) : "",
          is_active: o.is_active
        }))
      : [emptyRow()]
  );
  const [removed, setRemoved] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [tried, setTried] = useState(false);

  useEffect(() => {
    recordService.getCategories().then(setCategories).catch(() => undefined);
    recordService.getOwners().then(setOwners).catch(() => undefined);
  }, [recordService]);


  const problems: string[] = [];
  if (!title.trim()) problems.push("Título");
  if (!artist.trim()) problems.push("Artista");
  if (!deadline) problems.push("Fecha límite");
  if (rows.length === 0) problems.push("Al menos una versión");
  rows.forEach((row, i) => {
    const p = rowProblems(row);
    if (p.length) problems.push(`Versión ${i + 1}: ${p.join(", ")}`);
  });

  const update = (key: string, patch: Partial<OptionRow>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setTried(true);
    if (problems.length) return;
    setSaving(true);
    setError("");
    const fields = { title: title.trim(), artist: artist.trim(), description, purchase_deadline: deadline, estimated_arrival: arrival.trim(), cover };
    try {
      if (!presale) {
        onSaved(await service.admin.create(fields, rows.map(toInput)));
        return;
      }
      await service.admin.update(presale.id, fields);
      for (const id of removed) await service.admin.removeOption(id);
      for (const row of rows) {
        const data = toInput(row);
        if (!row.id) {
          await service.admin.addOption(presale.id, data);
        } else {
          const { price, min_deposit, full_payment_discount, ...rest } = data;
          await service.admin.updateOption(row.id, row.hasOrders ? rest : { ...rest, price, min_deposit, full_payment_discount });
        }
      }
      onSaved(await service.admin.get(presale.id));
    } catch (err) {
      setError(extractErrorMessage(err, "No pudimos guardar la preventa."));
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl text-denim">{presale ? "Editar preventa" : "Nueva preventa"}</h2>
        <button type="button" className={btnGhost} onClick={onCancel}>
          Cancelar
        </button>
      </div>

      <div className={`${panel} grid gap-5 md:grid-cols-[12rem_minmax(0,1fr)]`}>
        <label className="block">
          <span className={label}>Portada</span>
          <span className="mt-1 flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-navy/20 bg-cream/60 text-center text-xs text-navy/60 transition hover:border-orange">
            {preview ? <img src={preview} alt="Portada" className="h-full w-full object-cover" /> : "Elegir imagen"}
          </span>
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
              setCover(file);
              setPreview(file ? URL.createObjectURL(file) : presale?.cover_url ?? null);
            }}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={label}>Título *</span>
            <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="block">
            <span className={label}>Artista *</span>
            <input className={input} value={artist} onChange={(e) => setArtist(e.target.value)} />
          </label>
          <label className="block">
            <span className={label}>Último día para apartar *</span>
            <input type="date" className={input} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </label>
          <label className="block">
            <span className={label}>Llega aprox.</span>
            <input className={input} value={arrival} placeholder="enero 2027" onChange={(e) => setArrival(e.target.value)} />
          </label>
          <label className="block sm:col-span-2">
            <span className={label}>Descripción</span>
            <textarea
              rows={4}
              className={`${input} py-2`}
              value={description}
              placeholder="Edición, prensado, qué incluye…"
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-denim">Versiones</h3>
          <button type="button" className={btnGhost} onClick={() => setRows((rs) => [...rs, emptyRow()])}>
            Agregar versión
          </button>
        </div>
        {rows.map((row, i) => {
          const rp = tried ? rowProblems(row) : [];
          const price = num(row.price);
          const disc = num(row.full_payment_discount || "0");
          return (
            <fieldset key={row.key} className={`${panel} ${rp.length ? "border-coral/50" : ""}`}>
              <legend className="sr-only">Versión {i + 1}</legend>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-navy">
                  Versión {i + 1}
                  {row.hasOrders && <span className="ml-2 text-xs font-normal text-navy/60">{row.taken} apartadas · precio bloqueado</span>}
                </p>
                <div className="flex items-center gap-3">
                  {row.id && (
                    <label className="flex items-center gap-2 text-sm text-navy">
                      <input type="checkbox" className="h-4 w-4 accent-orange" checked={row.is_active} onChange={(e) => update(row.key, { is_active: e.target.checked })} />
                      Visible
                    </label>
                  )}
                  {!row.hasOrders && rows.length > 1 && (
                    <button
                      type="button"
                      className="min-h-[44px] px-2 text-sm font-semibold text-coral hover:underline"
                      onClick={() => {
                        if (row.id) setRemoved((r) => [...r, row.id as number]);
                        setRows((rs) => rs.filter((r) => r.key !== row.key));
                      }}
                    >
                      Quitar
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="block sm:col-span-2">
                  <span className={label}>Nombre *</span>
                  <input className={input} value={row.name} placeholder="Vinilo rojo 2LP" onChange={(e) => update(row.key, { name: e.target.value })} />
                </label>
                <label className="block">
                  <span className={label}>Formato</span>
                  <select className={input} value={row.category} onChange={(e) => update(row.key, { category: e.target.value })}>
                    <option value="">Sin formato</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className={label}>Copias *</span>
                  <input inputMode="numeric" className={input} value={row.copies} onChange={(e) => update(row.key, { copies: e.target.value.replace(/\D/g, "") })} />
                </label>
                <label className="block">
                  <span className={label}>Precio *</span>
                  <input inputMode="decimal" disabled={row.hasOrders} className={input} value={row.price} onChange={(e) => update(row.key, { price: e.target.value })} />
                </label>
                <label className="block">
                  <span className={label}>Apartado mínimo *</span>
                  <input inputMode="decimal" disabled={row.hasOrders} className={input} value={row.min_deposit} onChange={(e) => update(row.key, { min_deposit: e.target.value })} />
                </label>
                <label className="block">
                  <span className={label}>Descuento pago completo</span>
                  <input inputMode="decimal" disabled={row.hasOrders} className={input} value={row.full_payment_discount} onChange={(e) => update(row.key, { full_payment_discount: e.target.value })} />
                </label>
                <label className="block">
                  <span className={label}>Costo (privado)</span>
                  <input inputMode="decimal" className={input} value={row.cost_price} onChange={(e) => update(row.key, { cost_price: e.target.value })} />
                </label>
                <label className="block sm:col-span-2">
                  <span className={label}>Dueño</span>
                  <select className={input} value={row.owner} onChange={(e) => update(row.key, { owner: e.target.value })}>
                    <option value="">Tienda</option>
                    {owners.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </label>
                <label className="block sm:col-span-2">
                  <span className={label}>Peso en gramos (opcional, para box sets)</span>
                  <input inputMode="numeric" className={input} value={row.weight_grams} onChange={(e) => update(row.key, { weight_grams: e.target.value.replace(/\D/g, "") })} />
                </label>
              </div>
              {price > 0 && (
                <p className="mt-3 text-xs text-navy/70">
                  Pago completo: <strong className="text-navy">{currency(price - (disc || 0))}</strong>
                  {num(row.min_deposit) > 0 ? ` · apartado desde ${currency(num(row.min_deposit))}` : ""}
                </p>
              )}
              {rp.length > 0 && <p className="mt-2 text-xs text-coral">Revisa: {rp.join(", ")}.</p>}
            </fieldset>
          );
        })}
      </div>

      {error && <div role="alert" className={errorBox}>{error}</div>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={btnPrimary} disabled={saving} aria-describedby={tried && problems.length ? `${ids}-p` : undefined}>
          {saving ? "Guardando…" : presale ? "Guardar cambios" : "Guardar borrador"}
        </button>
        {tried && problems.length > 0 && (
          <p id={`${ids}-p`} className="text-sm text-coral">
            Falta: {problems.join(" · ")}
          </p>
        )}
        {!presale && <p className="text-xs text-navy/60">Se guarda como borrador; nadie la ve hasta que la publiques.</p>}
      </div>
    </form>
  );
}
