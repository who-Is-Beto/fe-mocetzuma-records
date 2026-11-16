import { useId, useState } from "react";
import type { AdminPresale, AdminPresaleOrder, PresaleDelivery } from "../../../app/domain/presales";
import { currency } from "../../../app/lib/format";
import { extractErrorMessage } from "../../../app/lib/httpClient";
import type { PresaleService } from "../../../app/services/presaleService";
import { Modal } from "../../../components/Modal";
import { btnGhost, btnPrimary, input, label, METHOD_LABEL } from "./ui";

const SOURCES = { instagram: "Instagram", store: "Tienda", other: "Otro" } as const;
const ADDRESS: [string, string][] = [
  ["fullName", "Nombre de quien recibe"],
  ["phone", "Teléfono"],
  ["street", "Calle"],
  ["number", "Número"],
  ["neighborhood", "Colonia"],
  ["city", "Ciudad"],
  ["state", "Estado"],
  ["zip", "Código postal"]
];

type Props = {
  service: PresaleService;
  presale: AdminPresale;
  onClose: () => void;
  onSaved: (order: AdminPresaleOrder) => void;
};

/** A buyer from Instagram or the counter: reserve their copy and record what they paid. */
const stepButton =
  "flex h-11 w-11 items-center justify-center rounded-full text-lg font-semibold text-navy ring-1 ring-navy/15 transition hover:bg-orange/15 hover:ring-orange active:scale-90 disabled:opacity-30 motion-reduce:active:scale-100";

export function RegisterPresaleOrder({ service, presale, onClose, onSaved }: Props) {
  const ids = useId();
  const available = presale.options.filter((o) => o.is_active && o.copies_left > 0);
  // Copies per version; staff can go over the per-person limit (it's for the website).
  const [quantities, setQuantities] = useState<Record<number, number>>(available[0] ? { [available[0].id]: 1 } : {});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState<keyof typeof SOURCES>("instagram");
  const [delivery, setDelivery] = useState<PresaleDelivery>("pickup");
  const [address, setAddress] = useState<Record<string, string>>({});
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<keyof typeof METHOD_LABEL>("transfer");
  const [note, setNote] = useState("");
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const lines = available.filter((o) => (quantities[o.id] ?? 0) > 0).map((o) => ({ option: o, quantity: quantities[o.id] }));
  const sum = (pick: (o: (typeof available)[number]) => string) =>
    Math.round(lines.reduce((t, l) => t + Number(pick(l.option)) * l.quantity, 0) * 100) / 100;
  const price = sum((o) => o.price);
  const full = price - sum((o) => o.full_payment_discount);
  const minimum = sum((o) => o.min_deposit);
  const value = Number(amount.replace(",", "."));
  const amountOk = /^\d+([.,]\d{1,2})?$/.test(amount) && value >= minimum && value <= price;
  const ready = lines.length > 0 && name.trim() && amountOk && terms && !busy;

  const save = async () => {
    if (!ready) return;
    setBusy(true);
    setError("");
    try {
      onSaved(
        await service.admin.createOrder({
          items: lines.map((l) => ({ option_id: l.option.id, quantity: l.quantity })),
          buyer_name: name.trim(),
          buyer_email: email.trim(),
          buyer_phone: phone.trim(),
          source,
          delivery,
          shipping_details: delivery === "shipping" ? address : undefined,
          amount: amount.replace(",", "."),
          method,
          note,
          terms_accepted: true
        })
      );
    } catch (err) {
      setError(extractErrorMessage(err, "No pudimos registrar la preventa."));
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} dismissible={!busy} labelledBy={`${ids}-t`} variant="sheet">
      <div className="max-h-[80vh] overflow-y-auto pr-1">
        <h3 id={`${ids}-t`} className="font-display text-lg text-denim">Registrar preventa</h3>
        <p className="mt-1 text-sm text-navy/70">Para quien apartó por Instagram o en la tienda.</p>
        {available.length === 0 ? (
          <p className="mt-4 rounded-xl bg-coral/10 px-3 py-2 text-sm text-coral">No quedan copias en ninguna versión.</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <fieldset className="sm:col-span-2">
              <legend className={label}>Versiones y copias</legend>
              <ul className="mt-1 divide-y divide-navy/10 rounded-xl bg-white/70 px-3 ring-1 ring-navy/10">
                {available.map((o) => {
                  const qty = quantities[o.id] ?? 0;
                  const set = (next: number) =>
                    setQuantities((q) => ({ ...q, [o.id]: Math.max(0, Math.min(next, o.copies_left)) }));
                  return (
                    <li key={o.id} className="flex items-center gap-3 py-2">
                      <span className="min-w-0 flex-1 text-sm">
                        <span className="block font-semibold text-navy">{o.name}</span>
                        <span className="block text-xs text-navy/60">{currency(o.price)} · quedan {o.copies_left}</span>
                      </span>
                      <button type="button" className={stepButton} disabled={qty === 0} onClick={() => set(qty - 1)} aria-label={`Quitar una de ${o.name}`}>
                        −
                      </button>
                      <span className="w-6 text-center font-semibold tabular-nums text-navy">{qty}</span>
                      <button type="button" className={stepButton} disabled={qty >= o.copies_left} onClick={() => set(qty + 1)} aria-label={`Agregar una de ${o.name}`}>
                        +
                      </button>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
            <label className="block">
              <span className={label}>Nombre *</span>
              <input className={input} value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="block">
              <span className={label}>¿Por dónde?</span>
              <select className={input} value={source} onChange={(e) => setSource(e.target.value as keyof typeof SOURCES)}>
                {Object.entries(SOURCES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={label}>Correo (le llegan los avisos)</span>
              <input type="email" className={input} value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="block">
              <span className={label}>Teléfono</span>
              <input type="tel" className={input} value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
            <label className="block">
              <span className={label}>Entrega</span>
              <select className={input} value={delivery} onChange={(e) => setDelivery(e.target.value as PresaleDelivery)}>
                <option value="pickup">Recoger en tienda</option>
                <option value="shipping">Envío a domicilio</option>
              </select>
            </label>
            <span />
            {delivery === "shipping" &&
              ADDRESS.map(([k, l]) => (
                <label key={k} className="block">
                  <span className={label}>{l}</span>
                  <input className={input} value={address[k] ?? ""} onChange={(e) => setAddress((a) => ({ ...a, [k]: e.target.value }))} />
                </label>
              ))}
            <label className="block">
              <span className={label}>Pagó hoy *</span>
              <input inputMode="decimal" className={input} value={amount} onChange={(e) => setAmount(e.target.value)} />
              <span className="mt-1 block text-xs text-navy/60">
                Mínimo {currency(minimum)} · completo {currency(full)}
                {full < price ? ` (con descuento)` : ""}
              </span>
            </label>
            <label className="block">
              <span className={label}>Forma de pago</span>
              <select className={input} value={method} onChange={(e) => setMethod(e.target.value as keyof typeof METHOD_LABEL)}>
                {Object.entries(METHOD_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className={label}>Nota</span>
              <input className={input} value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} />
            </label>
            <label className="flex items-start gap-3 rounded-xl bg-cream p-3 text-sm text-navy sm:col-span-2">
              <input type="checkbox" className="mt-0.5 h-5 w-5 accent-orange" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
              <span>El cliente aceptó que tiene 120 días para liquidar o pierde su apartado, y que la fecha de llegada es estimada.</span>
            </label>
          </div>
        )}
        {error && <p role="alert" className="mt-3 text-sm text-coral">{error}</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className={btnPrimary} disabled={!ready} onClick={save}>
            {busy ? "Guardando…" : "Registrar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
