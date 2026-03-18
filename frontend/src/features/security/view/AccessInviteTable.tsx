import { Button, Chip } from "@mui/material";

import type { CompanyInviteRecord } from "@/features/security/model/types";
import { DataViewToolbar, type DataViewFieldConfig } from "@/shared/components/data-view-toolbar";
import { ResourceTable } from "@/shared/components/resource-table";
import type { DataViewFilters } from "@/shared/hooks/use-data-view";
import type { SavedDataView } from "@/shared/storage/data-view-storage";
import type { PaginatedQueryState } from "@/shared/types/query";
import { parseApiError } from "@/shared/utils/parse-api-error";

interface InviteFilters extends DataViewFilters {
  email__icontains: string;
  status: string;
}

interface AccessInviteTableProps {
  invitesQuery: PaginatedQueryState<CompanyInviteRecord>;
  page: number;
  pageSize: number;
  setPage: (page: number) => void;
  filters: InviteFilters;
  activeFilterCount: number;
  updateFilter: (key: keyof InviteFilters & string, value: string) => void;
  resetFilters: () => void;
  savedViews: SavedDataView<InviteFilters>[];
  selectedSavedViewId: string | null;
  applySavedView: (viewId: string) => void;
  saveCurrentView: (name: string) => void;
  deleteSavedView: (viewId: string) => void;
  contextLabel?: string;
  onRevoke: (record: CompanyInviteRecord) => void;
  isRevoking: boolean;
}

const inviteFields: DataViewFieldConfig<InviteFilters>[] = [
  { key: "email__icontains", label: "Email", placeholder: "Search invite email" },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { label: "Pending", value: "PENDING" },
      { label: "Accepted", value: "ACCEPTED" },
      { label: "Revoked", value: "REVOKED" },
      { label: "Expired", value: "EXPIRED" },
    ],
  },
];

export function AccessInviteTable({
  invitesQuery,
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
}: AccessInviteTableProps) {
  return (
    <ResourceTable
      columns={[
        { header: "Email", key: "email", render: (row) => row.email },
        { header: "Role", key: "role", render: (row) => row.staff_type },
        { header: "Token", key: "token", render: (row) => row.invite_token },
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
      error={invitesQuery.error ? parseApiError(invitesQuery.error) : null}
      getRowId={(row) => row.id}
      isLoading={invitesQuery.isLoading}
      pagination={{
        page,
        pageSize,
        total: invitesQuery.data?.count ?? 0,
        onPageChange: setPage,
      }}
      rows={invitesQuery.data?.results ?? []}
      subtitle="Pending and historical company invite tokens."
      title="Access invites"
      toolbar={
        <DataViewToolbar
          activeFilterCount={activeFilterCount}
          contextLabel={contextLabel}
          fields={inviteFields}
          filters={filters}
          onChange={updateFilter}
          onReset={resetFilters}
          resultCount={invitesQuery.data?.count}
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
