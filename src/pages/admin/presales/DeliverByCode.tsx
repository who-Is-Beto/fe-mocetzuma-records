import { useEffect, useState, type FormEvent } from "react";
import type { AdminPresaleOrder } from "../../../app/domain/presales";
import { extractErrorMessage, HttpError } from "../../../app/lib/httpClient";
import type { PresaleService } from "../../../app/services/presaleService";
import { PresaleOrderPanel } from "./PresaleOrderPanel";
import { btnNavy, input, panel } from "./ui";

type Props = {
  service: PresaleService;
  can: (perm: string) => boolean;
  /** From ?code= (scanning the customer's QR lands here). */
  initialCode: string | null;
  onClose: () => void;
};

/** "Entregar preventa": type or scan the customer's code and open their order. */
export function DeliverByCode({ service, can, initialCode, onClose }: Props) {
  const [code, setCode] = useState(initialCode ?? "");
  const [order, setOrder] = useState<AdminPresaleOrder | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const lookup = async (value: string) => {
    const clean = value.trim();
    if (!clean) return;
    setBusy(true);
    setError("");
    try {
      setOrder(await service.admin.byCode(clean));
    } catch (err) {
      setError(err instanceof HttpError && err.status === 404 ? `No existe la preventa ${clean.toUpperCase()}.` : extractErrorMessage(err, "No pudimos buscarla."));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (initialCode) void lookup(initialCode);
    // Only on arrival from a scanned QR.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void lookup(code);
  };

  return (
    <>
      <form onSubmit={submit} className={`${panel} flex flex-col gap-3 sm:flex-row sm:items-end`}>
        <label className="block min-w-0 flex-1">
          <span className="text-sm font-semibold text-denim">Entregar preventa</span>
          <span className="block text-xs text-navy/60">Escribe el código del cliente o escanea su QR con la cámara.</span>
          <input
            className={`${input} font-mono uppercase tracking-wider`}
            value={code}
            placeholder="PV-7K3Q"
            autoCapitalize="characters"
            onChange={(e) => setCode(e.target.value)}
          />
        </label>
        <button type="submit" className={btnNavy} disabled={busy || !code.trim()}>
          {busy ? "Buscando…" : "Buscar código"}
        </button>
      </form>
      {error && <p role="alert" className="-mt-2 text-sm text-coral">{error}</p>}
      {order && (
        <PresaleOrderPanel
          service={service}
          order={order}
          can={can}
          onClose={() => {
            setOrder(null);
            setCode("");
            if (initialCode) onClose();
          }}
          onChanged={setOrder}
        />
      )}
    </>
  );
}
