export interface WorkspaceOnboardingStatus {
  is_required: boolean;
  can_manage_setup: boolean;
  warehouse_count: number;
  storage_area_count: number;
  location_type_count: number;
  location_count: number;
}

export interface WorkspaceSetupPayload {
  warehouse_name: string;
  warehouse_code: string;
  storage_area_name: string;
  storage_area_code: string;
  location_type_name: string;
  location_type_code: string;
  shelf_prefix: string;
  aisle_count: number;
  bay_count: number;
  level_count: number;
  slot_count: number;
}

export interface WorkspaceSetupResult {
  warehouse_id: number;
  warehouse_name: string;
  storage_area_id: number;
  storage_area_code: string;
  location_type_id: number;
  location_type_code: string;
  created_location_count: number;
  status: WorkspaceOnboardingStatus;
}

export type WorkspaceSetupFormValues = WorkspaceSetupPayload;
