import { API_BASE_URL } from "../config/api";
import type { Category, Record, RecordPage, RecordRepository } from "../domain/album";
import { http } from "../lib/httpClient";

type RecordServiceConfig = {
  baseUrl?: string;
  getToken?: () => string | null;
};

const withBase = (baseUrl: string, path: string) =>
  `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}/`;

export function createRecordService(config: RecordServiceConfig = {}): RecordRepository {
  const baseUrl = config.baseUrl ?? API_BASE_URL;
  const getToken = config.getToken;

  return {
    async list(params?: { page?: number; available?: boolean; category?: string }) {
      const query: { [key: string]: string | number | boolean } = {};
      if (params?.page) query.page = params.page;
      if (params?.available !== undefined) query.available = params.available;
      if (params?.category) query.category = params.category;
      return http<RecordPage>(withBase(baseUrl, "/records"), {
        token: getToken?.() ?? undefined,
        query: Object.keys(query).length > 0 ? query : undefined,
      });
    },
    async search(params: { query: string; page?: number; available?: boolean; category?: string }) {
      const query: { [key: string]: string | number | boolean } = { query: params.query };
      if (params.page) query.page = params.page;
      if (params.available !== undefined) query.available = params.available;
      if (params.category) query.category = params.category;
      return http<RecordPage>(withBase(baseUrl, "/search"), {
        token: getToken?.() ?? undefined,
        query,
      });
    },
    async getRecordById(id: string) {
      return http<Record>(withBase(baseUrl, `/records/${id}`), {
        token: getToken?.() ?? undefined,
      });
    },
    async getRecordBySlug(slug: string) {
      // Backend expects the record name/slug directly under /records/:record_name
      const safeSlug = encodeURIComponent(slug);
      return http<Record>(withBase(baseUrl, `/records/${safeSlug}`), {
        token: getToken?.() ?? undefined,
      });
    },
    async getCategories() {
      return http<Category[]>(withBase(baseUrl, "/categories"), {
        token: getToken?.() ?? undefined,
      });
    },
  };
}
