import { createContext, useContext } from "react";
import type { MaintenanceConfig } from "../domain/site";

type MaintenanceStatusValue = {
  config: MaintenanceConfig | null;
  isLoading: boolean;
  refetch(): void;
};

/**
 * Shared maintenance status for storefront pages that must adapt while the
 * window is open (currently: the home view shows a maintenance notice instead
 * of the catalog). Layout polls the public endpoint and provides this.
 */
export const MaintenanceStatusContext = createContext<MaintenanceStatusValue>({
  config: null,
  isLoading: false,
  refetch: () => {}
});

export function useMaintenanceStatusValue(): MaintenanceStatusValue {
  return useContext(MaintenanceStatusContext);
}