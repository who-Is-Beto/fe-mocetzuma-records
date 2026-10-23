import { API_BASE_URL } from "../config/api";
import type {
  SaleInput,
  SaleResult,
  SalesFilters,
  SalesMetrics,
  SalesReport
} from "../domain/sales";
import { http } from "../lib/httpClient";

type SalesServiceConfig = {
  baseUrl?: string;
  getToken?: () => string | null;
};

const withBase = (baseUrl: string, path: string) =>
  `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}/`;

/**
 * Repository for the /sales/ API — registering a sale from Punto de venta,
 * the Ventas history and its metrics.
 */
export function createSalesService(config: SalesServiceConfig = {}): {
  register(input: SaleInput): Promise<SaleResult>;
  list(filters: SalesFilters): Promise<SalesReport>;
  /** Point of sale + online orders; `owner` is ignored. */
  metrics(filters: SalesFilters): Promise<SalesMetrics>;
  /** Every sold line (point of sale + online) as CSV text, same filters as `list`. */
  exportCsv(filters: SalesFilters): Promise<string>;
} {
  const baseUrl = config.baseUrl ?? API_BASE_URL;
  const getToken = config.getToken;

  return {
    async register(input) {
      return http<SaleResult>(withBase(baseUrl, "/sales/create"), {
        method: "POST",
        token: getToken?.() ?? undefined,
        body: input
      });
    },
    async list(filters) {
      return http<SalesReport>(withBase(baseUrl, "/sales"), {
        token: getToken?.() ?? undefined,
        query: filters
      });
    },
    async metrics(filters) {
      return http<SalesMetrics>(withBase(baseUrl, "/sales/metrics"), {
        token: getToken?.() ?? undefined,
        query: filters
      });
    },
    async exportCsv(filters) {
      return http<string>(withBase(baseUrl, "/sales/export"), {
        // Default JSON Accept on purpose: DRF 406s an Accept no renderer has;
        // the view answers CSV anyway (errors still come back as JSON).
        token: getToken?.() ?? undefined,
        query: filters
      });
    }
  };
}
