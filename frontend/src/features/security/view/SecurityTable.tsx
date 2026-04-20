import { Button, Chip } from "@mui/material";

import { DataViewToolbar, type DataViewFieldConfig } from "@/shared/components/data-view-toolbar";
import { ResourceTable } from "@/shared/components/resource-table";
import type { DataViewFilters } from "@/shared/hooks/use-data-view";
import type { SavedDataView } from "@/shared/storage/data-view-storage";
import type { StaffRecord } from "@/features/security/model/types";
import type { PaginatedQueryState } from "@/shared/types/query";
import { parseApiError } from "@/shared/utils/parse-api-error";

interface StaffFilters extends DataViewFilters {
  staff_name__icontains: string;
  staff_type: string;
}

interface SecurityTableProps {
  staffQuery: PaginatedQueryState<StaffRecord>;
  page: number;
  pageSize: number;
  setPage: (page: number) => void;
  filters: StaffFilters;
  activeFilterCount: number;
  updateFilter: (key: keyof StaffFilters & string, value: string) => void;
  resetFilters: () => void;
  savedViews: SavedDataView<StaffFilters>[];
  selectedSavedViewId: string | null;
  applySavedView: (viewId: string) => void;
  saveCurrentView: (name: string) => void;
  deleteSavedView: (viewId: string) => void;
  roleOptions: Array<{ label: string; value: string }>;
  contextLabel?: string;
  onEdit: (record: StaffRecord) => void;
}

export const securityFilterFields = (
  roleOptions: Array<{ label: string; value: string }>,
): DataViewFieldConfig<StaffFilters>[] => [
  {
    key: "staff_name__icontains",
    label: "Staff name",
    placeholder: "Find by operator name",
  },
  {
    key: "staff_type",
    label: "Role",
    type: "select",
    options: roleOptions,
  },
];

export function SecurityTable({
  staffQuery,
  page,
  pageSize,
  setPage,
  filters,
  activeFilterCount,
  updateFilter,
  resetFilters,
  savedViews,
  selectedSavedViewId,
  applySavedView,
  saveCurrentView,
  deleteSavedView,
  roleOptions,
  contextLabel,
  onEdit,
}: SecurityTableProps) {
  return (
    <ResourceTable
      columns={[
        { header: "Name", key: "name", render: (row) => row.staff_name },
        { header: "Role", key: "role", render: (row) => row.staff_type },
        { header: "Check code", key: "checkCode", render: (row) => row.check_code },
        {
          header: "Lock",
          key: "lock",
          render: (row) => (
            <Chip
              color={row.is_lock ? "error" : "success"}
              label={row.is_lock ? "Locked" : "Active"}
              size="small"
              variant={row.is_lock ? "filled" : "outlined"}
            />
          ),
        },
        { header: "Failed codes", key: "errors", render: (row) => row.error_check_code_counter },
        { header: "Updated", key: "updated", render: (row) => row.update_time },
        {
          header: "Action",
          key: "action",
          render: (row) => (
            <Button onClick={() => onEdit(row)} size="small" variant="outlined">
              Edit
            </Button>
          ),
        },
      ]}
      error={staffQuery.error ? parseApiError(staffQuery.error) : null}
      getRowId={(row) => row.id}
      isLoading={staffQuery.isLoading}
      pagination={{
        page,
        pageSize,
        total: staffQuery.data?.count ?? 0,
        onPageChange: setPage,
      }}
      rows={staffQuery.data?.results ?? []}
      subtitle="Tenant-scoped staff directory used for route guards, handheld access, and verification codes."
      title="Staff access directory"
      toolbar={
        <DataViewToolbar
          activeFilterCount={activeFilterCount}
          contextLabel={contextLabel}
          fields={securityFilterFields(roleOptions)}
          filters={filters}
          onChange={updateFilter}
          onReset={resetFilters}
          resultCount={staffQuery.data?.count}
          savedViews={{
            items: savedViews,
            selectedId: selectedSavedViewId,
            onApply: applySavedView,
            onDelete: deleteSavedView,
            onSave: saveCurrentView,
          }}
        />
      }
    />
  );
}
