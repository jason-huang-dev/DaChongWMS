import { apiGet, apiPostForm } from "@/lib/http";

import type { InventoryInformationImportApiRow } from "@/features/inventory/model/types";

export const inventoryApi = {
  balances: "/api/inventory/balances/",
  movements: "/api/inventory/movements/",
  adjustmentReasons: "/api/inventory/adjustment-reasons/",
  adjustmentRules: "/api/inventory/adjustment-rules/",
} as const;

export function buildInventoryInformationImportTemplatePath(organizationId: number | string) {
  return `/api/v1/organizations/${organizationId}/inventory/information-import-template/`;
}

export function buildInventoryInformationImportUploadPath(organizationId: number | string) {
  return `/api/v1/organizations/${organizationId}/inventory/information-imports/upload/`;
}

export function fetchInventoryInformationImportTemplate(organizationId: number | string) {
  return apiGet<Blob>(buildInventoryInformationImportTemplatePath(organizationId));
}

export function uploadInventoryInformationWorkbook(
  organizationId: number | string,
  file: File,
  existingRowsJson: string,
) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("existing_rows", existingRowsJson);

  return apiPostForm<{
    imported_rows: InventoryInformationImportApiRow[];
    warnings: string[];
    errors: string[];
  }>(buildInventoryInformationImportUploadPath(organizationId), formData);
}
