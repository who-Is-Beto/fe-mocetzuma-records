import { API_BASE_URL } from "../config/api";
import type { MaintenanceConfig } from "../domain/site";
import { http } from "../lib/httpClient";

type ConfigServiceConfig = {
  baseUrl?: string;
};

const withBase = (baseUrl: string, path: string) =>
  `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;

export type ConfigRepository = {
  /**
   * Public maintenance status — never send a token: the endpoint must keep
   * answering while the window is open so the storefront can detect it.
   */
  getMaintenanceConfig(token?: string | null): Promise<MaintenanceConfig>;
  /** Admin-only: open/close the maintenance window and set its message. */
  setMaintenanceConfig(
    input: MaintenanceConfig,
    token?: string | null
  ): Promise<MaintenanceConfig>;
};

export function createConfigService(
  config: ConfigServiceConfig = {}
): ConfigRepository {
  const baseUrl = config.baseUrl ?? API_BASE_URL;

  return {
    async getMaintenanceConfig(token) {
      return http<MaintenanceConfig>(withBase(baseUrl, "/config/maintenance/"), {
        token
      });
    },
    async setMaintenanceConfig(input, token) {
      return http<MaintenanceConfig>(withBase(baseUrl, "/config/maintenance/"), {
        method: "PATCH",
        body: input,
        token
      });
    }
  };
}