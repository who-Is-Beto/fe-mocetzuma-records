import { API_BASE_URL } from "../config/api";
import type { Bazar } from "../domain/bazares";
import { http } from "../lib/httpClient";

/** Writable bazar fields for admin create/update (multipart with image). */
export type BazarInput = {
  name: string;
  date: string;
  schedule: string;
  address: string;
  google_maps_url: string;
  /** New flyer to upload. Omit on update to keep the current one. */
  image?: File | null;
};

type BazarServiceConfig = {
  baseUrl?: string;
  getToken?: () => string | null;
};

const withBase = (baseUrl: string, path: string) =>
  `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}/`;

const toFormData = (input: BazarInput): FormData => {
  const data = new FormData();
  data.append("name", input.name);
  data.append("date", input.date);
  data.append("schedule", input.schedule);
  data.append("address", input.address);
  data.append("google_maps_url", input.google_maps_url);
  // Only send a file when a new image was picked; otherwise the backend
  // keeps the existing upload.
  if (input.image) data.append("image", input.image);
  return data;
};

/**
 * Repository for the /bazares/ API. Public reads need no token; admin
 * writes use the token provider (see cartService for the same pattern).
 */
export function createBazarService(config: BazarServiceConfig = {}): {
  getUpcoming(): Promise<Bazar[]>;
  getAll(): Promise<Bazar[]>;
  create(input: BazarInput): Promise<Bazar>;
  update(bazarId: number, input: BazarInput): Promise<Bazar>;
  remove(bazarId: number): Promise<{ message?: string }>;
} {
  const baseUrl = config.baseUrl ?? API_BASE_URL;
  const getToken = config.getToken;
  const auth = () => ({ token: getToken?.() ?? undefined });

  return {
    async getUpcoming() {
      return http<Bazar[]>(withBase(baseUrl, "/bazares"));
    },
    async getAll() {
      return http<Bazar[]>(withBase(baseUrl, "/bazares/all"), auth());
    },
    async create(input: BazarInput) {
      return http<Bazar>(withBase(baseUrl, "/bazares/create"), {
        method: "POST",
        body: toFormData(input),
        ...auth()
      });
    },
    async update(bazarId: number, input: BazarInput) {
      return http<Bazar>(withBase(baseUrl, `/bazares/${bazarId}/update`), {
        method: "PATCH",
        body: toFormData(input),
        ...auth()
      });
    },
    async remove(bazarId: number) {
      return http<{ message?: string }>(
        withBase(baseUrl, `/bazares/${bazarId}/delete`),
        { method: "DELETE", ...auth() }
      );
    }
  };
}
