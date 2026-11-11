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
export function RegisterPresaleOrder({ service, presale, onClose, onSaved }: Props) {
  const ids = useId();
  const available = presale.options.filter((o) => o.is_active && o.copies_left > 0);
  const [optionId, setOptionId] = useState(available[0]?.id ?? 0);
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

  const option = presale.options.find((o) => o.id === optionId);
  const price = Number(option?.price ?? 0);
  const full = price - Number(option?.full_payment_discount ?? 0);
  const value = Number(amount.replace(",", "."));
  const amountOk = /^\d+([.,]\d{1,2})?$/.test(amount) && value >= Number(option?.min_deposit ?? 0) && value <= price;
  const ready = option && name.trim() && amountOk && terms && !busy;

  const save = async () => {
    if (!ready || !option) return;
    setBusy(true);
    setError("");
    try {
      onSaved(
        await service.admin.createOrder({
          option_id: option.id,
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
            <label className="block sm:col-span-2">
              <span className={label}>Versión</span>
              <select className={input} value={optionId} onChange={(e) => setOptionId(Number(e.target.value))}>
                {available.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} · {currency(o.price)} · quedan {o.copies_left}
                  </option>
                ))}
              </select>
            </label>
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
                Mínimo {currency(option?.min_deposit ?? 0)} · completo {currency(full)}
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
              <span>El cliente aceptó que si no liquida en 120 días (o 15 días después de que llegue el disco) pierde su apartado.</span>
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
