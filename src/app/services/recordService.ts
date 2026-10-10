import { API_BASE_URL } from "../config/api";
import type {
  Artist,
  ArtistDeleteResult,
  ArtistReassign,
  ArtistUsage,
  CatalogTermInput,
  Category,
  CategoryDeleteResult,
  Genere,
  Owner,
  Record,
  RecordInput,
  RecordFilters,
  RecordPage,
  RecordRepository
} from "../domain/album";
import { http } from "../lib/httpClient";

type RecordServiceConfig = {
  baseUrl?: string;
  getToken?: () => string | null;
};

const withBase = (baseUrl: string, path: string) =>
  `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}/`;

/** RecordFilters -> query params; empty values are left out. */
const filterQuery = ({ condition, ...params }: RecordFilters = {}) => {
  const query: { [key: string]: string | number | boolean } = {};
  Object.entries(params).forEach(([key, value]) => {
    if (key === "signal" || value === undefined || value === "" || value === null) return;
    query[key] = value as string | number | boolean;
  });
  if (condition?.length) query.condition = condition.join(",");
  return query;
};

export function createRecordService(config: RecordServiceConfig = {}): RecordRepository {
  const baseUrl = config.baseUrl ?? API_BASE_URL;
  const getToken = config.getToken;

  return {
    async list(params?: RecordFilters) {
      const query = filterQuery(params);
      return http<RecordPage>(withBase(baseUrl, "/records"), {
        token: getToken?.() ?? undefined,
        query: Object.keys(query).length > 0 ? query : undefined,
        signal: params?.signal,
      });
    },
    async search({ query: q, ...params }: RecordFilters & { query: string }) {
      return http<RecordPage>(withBase(baseUrl, "/search"), {
        token: getToken?.() ?? undefined,
        query: { query: q, ...filterQuery(params) },
        signal: params.signal,
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
        token: getToken?.() ?? undefined
      });
    },
    async getGenres() {
      return http<Genere[]>(withBase(baseUrl, "/generes"), {
        token: getToken?.() ?? undefined
      });
    },
    async searchArtists(query: string) {
      return http<Artist[]>(withBase(baseUrl, "/artists/search"), {
        token: getToken?.() ?? undefined,
        query: { q: query }
      });
    },
    async createArtist(name: string) {
      return http<Artist>(withBase(baseUrl, "/artists/create"), {
        method: "POST",
        token: getToken?.() ?? undefined,
        body: { name }
      });
    },
    async createCategory(input: CatalogTermInput) {
      return http<Category>(withBase(baseUrl, "/categories/create"), {
        method: "POST",
        token: getToken?.() ?? undefined,
        body: input
      });
    },
    async updateCategory(id: Category["id"], input: Partial<CatalogTermInput>) {
      return http<Category>(withBase(baseUrl, `/categories/${id}/update`), {
        method: "PATCH",
        token: getToken?.() ?? undefined,
        body: input
      });
    },
    async deleteCategory(id: Category["id"], reassignTo?: Category["id"]) {
      return http<CategoryDeleteResult>(withBase(baseUrl, `/categories/${id}/delete`), {
        method: "DELETE",
        token: getToken?.() ?? undefined,
        body: reassignTo === undefined ? {} : { reassign_to: reassignTo }
      });
    },
    async createGenre(input: CatalogTermInput) {
      return http<Genere>(withBase(baseUrl, "/generes/create"), {
        method: "POST",
        token: getToken?.() ?? undefined,
        body: input
      });
    },
    async updateGenre(id: Genere["id"], input: Partial<CatalogTermInput>) {
      return http<Genere>(withBase(baseUrl, `/generes/${id}/update`), {
        method: "PATCH",
        token: getToken?.() ?? undefined,
        body: input
      });
    },
    async deleteGenre(id: Genere["id"]) {
      return http<{ deleted: Genere["id"]; records_count: number }>(
        withBase(baseUrl, `/generes/${id}/delete`),
        { method: "DELETE", token: getToken?.() ?? undefined }
      );
    },
    async getOwners() {
      return http<Owner[]>(withBase(baseUrl, "/owners"), {
        token: getToken?.() ?? undefined
      });
    },
    async createOwner(input: { name: string; email: string }) {
      return http<Owner>(withBase(baseUrl, "/owners/create"), {
        method: "POST",
        token: getToken?.() ?? undefined,
        body: input
      });
    },
    async findMatches(title: string, artist: string) {
      return http<Record[]>(withBase(baseUrl, "/records/matches"), {
        token: getToken?.() ?? undefined,
        query: { title, artist }
      });
    },
    async getForEdit(id: string | number) {
      return http<Record>(withBase(baseUrl, `/records/${id}/update`), {
        token: getToken?.() ?? undefined
      });
    },
    async create(input: RecordInput) {
      return http<Record>(withBase(baseUrl, "/records/create"), {
        method: "POST",
        token: getToken?.() ?? undefined,
        body: input
      });
    },
    async update(id: string | number, patch: Partial<RecordInput>) {
      return http<Record>(withBase(baseUrl, `/records/${id}/update`), {
        method: "PATCH",
        token: getToken?.() ?? undefined,
        body: patch
      });
    },
    async getArtistUsage(id: Artist["id"]) {
      return http<ArtistUsage>(withBase(baseUrl, `/artists/${id}/usage`), {
        token: getToken?.() ?? undefined
      });
    },
    async deleteArtist(id: Artist["id"], reassign: ArtistReassign) {
      return http<ArtistDeleteResult>(withBase(baseUrl, `/artists/${id}/delete`), {
        method: "DELETE",
        token: getToken?.() ?? undefined,
        body: reassign
      });
    },
    async remove(id: string | number) {
      return http<{ message?: string }>(
        withBase(baseUrl, `/records/${id}/delete`),
        { method: "DELETE", token: getToken?.() ?? undefined }
      );
    },
  };
}
