import type { Record as AlbumRecord, RecordOwnerStock } from "../../../app/domain/album";
import { toCents } from "../../../app/domain/sales";

/** A line of the sale ticket; `price` is the raw input value (unit, MXN).
 * `owners` are the ones with stock and `cost` the record's cost price (both
 * null while the full record loads). With several owners `split` says how
 * many units of each are sold and `quantity` is their sum. */
export type TicketLine = {
  record: AlbumRecord;
  quantity: number;
  price: string;
  owners: RecordOwnerStock[] | null;
  cost: string | null;
  split: { [ownerId: string]: number };
};

export const isSplit = (line: TicketLine) => (line.owners?.length ?? 0) > 1;

// An empty price means the record's current price (the backend's default too).
export const unitPrice = (line: TicketLine) =>
  Number(line.price.trim() || line.record.sell_price || line.record.price) || 0;

/** Integer cents, so the preview matches the backend's Decimal math exactly. */
export const subtotalCents = (lines: TicketLine[]) =>
  lines.reduce((sum, l) => sum + toCents(unitPrice(l)) * l.quantity, 0);
