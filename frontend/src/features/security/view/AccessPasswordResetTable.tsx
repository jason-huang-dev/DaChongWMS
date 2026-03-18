import { Button, Chip } from "@mui/material";

import type { CompanyPasswordResetRecord } from "@/features/security/model/types";
import { DataViewToolbar, type DataViewFieldConfig } from "@/shared/components/data-view-toolbar";
import { ResourceTable } from "@/shared/components/resource-table";
import type { DataViewFilters } from "@/shared/hooks/use-data-view";
import type { SavedDataView } from "@/shared/storage/data-view-storage";
import type { PaginatedQueryState } from "@/shared/types/query";
import { parseApiError } from "@/shared/utils/parse-api-error";

interface PasswordResetFilters extends DataViewFilters {
  membership__auth_user__username__icontains: string;
  status: string;
}

interface AccessPasswordResetTableProps {
  resetsQuery: PaginatedQueryState<CompanyPasswordResetRecord>;
  page: number;
  pageSize: number;
  setPage: (page: number) => void;
  filters: PasswordResetFilters;
  activeFilterCount: number;
  updateFilter: (key: keyof PasswordResetFilters & string, value: string) => void;
  resetFilters: () => void;
  savedViews: SavedDataView<PasswordResetFilters>[];
  selectedSavedViewId: string | null;
  applySavedView: (viewId: string) => void;
  saveCurrentView: (name: string) => void;
  deleteSavedView: (viewId: string) => void;
  contextLabel?: string;
  onRevoke: (record: CompanyPasswordResetRecord) => void;
  isRevoking: boolean;
}

const passwordResetFields: DataViewFieldConfig<PasswordResetFilters>[] = [
  { key: "membership__auth_user__username__icontains", label: "Username", placeholder: "Search username" },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { label: "Pending", value: "PENDING" },
      { label: "Completed", value: "COMPLETED" },
      { label: "Revoked", value: "REVOKED" },
      { label: "Expired", value: "EXPIRED" },
    ],
  },
];

export function AccessPasswordResetTable({
  resetsQuery,
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
  contextLabel,
  onRevoke,
  isRevoking,
}: AccessPasswordResetTableProps) {
  return (
    <ResourceTable
      columns={[
        { header: "Username", key: "username", render: (row) => row.username },
        { header: "Email", key: "email", render: (row) => row.email },
        { header: "Reset token", key: "token", render: (row) => row.reset_token },
        { header: "Expires", key: "expires", render: (row) => row.expires_at },
        {
          header: "Status",
          key: "status",
          render: (row) => <Chip label={row.status} size="small" variant={row.status === "PENDING" ? "filled" : "outlined"} />,
        },
        {
          header: "Action",
          key: "action",
          render: (row) =>
            row.status === "PENDING" ? (
              <Button disabled={isRevoking} onClick={() => onRevoke(row)} size="small" variant="text">
                Revoke
              </Button>
            ) : (
              "--"
            ),
        },
      ]}
      error={resetsQuery.error ? parseApiError(resetsQuery.error) : null}
      getRowId={(row) => row.id}
      isLoading={resetsQuery.isLoading}
      pagination={{
        page,
        pageSize,
        total: resetsQuery.data?.count ?? 0,
        onPageChange: setPage,
      }}
      rows={resetsQuery.data?.results ?? []}
      subtitle="Issued password-reset tokens for company-managed browser accounts."
      title="Password resets"
      toolbar={
        <DataViewToolbar
          activeFilterCount={activeFilterCount}
          contextLabel={contextLabel}
          fields={passwordResetFields}
          filters={filters}
          onChange={updateFilter}
          onReset={resetFilters}
          resultCount={resetsQuery.data?.count}
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
