/** Site-wide configuration shared by the storefront and the admin console. */
export type MaintenanceConfig = {
  maintenance_mode: boolean;
  maintenance_message: string;
};