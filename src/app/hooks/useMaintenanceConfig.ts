import type { MaintenanceConfig } from "../domain/site";
import { useAuth } from "../providers/AuthProvider";
import { createConfigService } from "../services/configService";
import { useServiceQuery } from "./useServiceQuery";

/**
 * Admin-side maintenance config: reads and flips the window. Only ever mounted
 * inside the AdminPage guard, so the PATCH with the caller's token is fine.
 */
export function useMaintenanceConfig(): {
  config: MaintenanceConfig | null;
  isLoading: boolean;
  isError: boolean;
  save(mode: boolean, message: string): Promise<MaintenanceConfig | null>;
  refetch(): Promise<MaintenanceConfig | null>;
} {
  const { token } = useAuth();
  const configService = createConfigService();

  const query = useServiceQuery(
    ["maintenance-config"],
    async () => {
      try {
        return await configService.getMaintenanceConfig(token);
      } catch {
        return null;
      }
    },
    { enabled: true }
  );

  const save = async (
    mode: boolean,
    message: string
  ): Promise<MaintenanceConfig | null> => {
    await configService.setMaintenanceConfig(
      { maintenance_mode: mode, maintenance_message: message },
      token
    );
    return (await query.refetch()) ?? null;
  };

  return {
    config: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    save,
    refetch: async () => (await query.refetch()) ?? null,
  };
}