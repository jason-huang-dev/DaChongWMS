import { Button, Chip } from "@mui/material";

import type { CompanyMembershipRecord } from "@/features/security/model/types";
import { DataViewToolbar, type DataViewFieldConfig } from "@/shared/components/data-view-toolbar";
import { ResourceTable } from "@/shared/components/resource-table";
import type { DataViewFilters } from "@/shared/hooks/use-data-view";
import type { SavedDataView } from "@/shared/storage/data-view-storage";
import type { PaginatedQueryState } from "@/shared/types/query";
import { parseApiError } from "@/shared/utils/parse-api-error";

interface MembershipFilters extends DataViewFilters {
  auth_user__username__icontains: string;
  staff__staff_type: string;
}

interface CompanyMembershipTableProps {
  membershipsQuery: PaginatedQueryState<CompanyMembershipRecord>;
  page: number;
  pageSize: number;
  setPage: (page: number) => void;
  filters: MembershipFilters;
  activeFilterCount: number;
  updateFilter: (key: keyof MembershipFilters & string, value: string) => void;
  resetFilters: () => void;
  savedViews: SavedDataView<MembershipFilters>[];
  selectedSavedViewId: string | null;
  applySavedView: (viewId: string) => void;
  saveCurrentView: (name: string) => void;
  deleteSavedView: (viewId: string) => void;
  roleOptions: Array<{ label: string; value: string }>;
  contextLabel?: string;
  onEdit: (record: CompanyMembershipRecord) => void;
  onIssuePasswordReset: (record: CompanyMembershipRecord) => void;
  isIssuingPasswordReset: boolean;
}

const membershipFilterFields = (
  roleOptions: Array<{ label: string; value: string }>,
): DataViewFieldConfig<MembershipFilters>[] => [
  { key: "auth_user__username__icontains", label: "Username", placeholder: "Search browser accounts" },
  {
    key: "staff__staff_type",
    label: "Role",
    type: "select",
    options: roleOptions,
  },
];

export function CompanyMembershipTable({
  membershipsQuery,
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
  onIssuePasswordReset,
  isIssuingPasswordReset,
}: CompanyMembershipTableProps) {
  return (
    <ResourceTable
      columns={[
        { header: "Username", key: "username", render: (row) => row.username },
        { header: "Email", key: "email", render: (row) => row.email },
        { header: "Staff", key: "staff", render: (row) => row.staff_name },
        { header: "Role", key: "role", render: (row) => row.staff_type },
        {
          header: "Admin",
          key: "admin",
          render: (row) =>
            row.is_company_admin ? <Chip color="primary" label="Company admin" size="small" /> : <Chip label="Member" size="small" variant="outlined" />,
        },
        {
          header: "Access",
          key: "access",
          render: (row) => (
            <Chip
              color={row.is_active && !row.is_lock ? "success" : "warning"}
              label={row.is_active ? (row.is_lock ? "Locked" : "Active") : "Inactive"}
              size="small"
              variant={row.is_active && !row.is_lock ? "outlined" : "filled"}
            />
          ),
        },
        { header: "Warehouse", key: "warehouse", render: (row) => row.default_warehouse_name || "--" },
        {
          header: "Action",
          key: "action",
          render: (row) => (
            <>
              <Button onClick={() => onEdit(row)} size="small" variant="outlined">
                Edit
              </Button>
              <Button
                disabled={isIssuingPasswordReset}
                onClick={() => onIssuePasswordReset(row)}
                size="small"
                sx={{ ml: 1 }}
                variant="text"
              >
                Reset
              </Button>
            </>
          ),
        },
      ]}
      error={membershipsQuery.error ? parseApiError(membershipsQuery.error) : null}
      getRowId={(row) => row.id}
      isLoading={membershipsQuery.isLoading}
      pagination={{
        page,
        pageSize,
        total: membershipsQuery.data?.count ?? 0,
        onPageChange: setPage,
      }}
      rows={membershipsQuery.data?.results ?? []}
      subtitle="Browser users provisioned for the current company, with workspace switching and user-management privileges."
      title="Company memberships"
      toolbar={
        <DataViewToolbar
          activeFilterCount={activeFilterCount}
          contextLabel={contextLabel}
          fields={membershipFilterFields(roleOptions)}
          filters={filters}
          onChange={updateFilter}
          onReset={resetFilters}
          resultCount={membershipsQuery.data?.count}
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
