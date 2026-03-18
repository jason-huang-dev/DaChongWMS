import type { AccessAuditEventRecord } from "@/features/security/model/types";
import { DataViewToolbar, type DataViewFieldConfig } from "@/shared/components/data-view-toolbar";
import { ResourceTable } from "@/shared/components/resource-table";
import type { DataViewFilters } from "@/shared/hooks/use-data-view";
import type { SavedDataView } from "@/shared/storage/data-view-storage";
import type { PaginatedQueryState } from "@/shared/types/query";
import { parseApiError } from "@/shared/utils/parse-api-error";

interface AuditFilters extends DataViewFilters {
  target_identifier__icontains: string;
  action_type: string;
}

interface AccessAuditTableProps {
  auditQuery: PaginatedQueryState<AccessAuditEventRecord>;
  page: number;
  pageSize: number;
  setPage: (page: number) => void;
  filters: AuditFilters;
  activeFilterCount: number;
  updateFilter: (key: keyof AuditFilters & string, value: string) => void;
  resetFilters: () => void;
  savedViews: SavedDataView<AuditFilters>[];
  selectedSavedViewId: string | null;
  applySavedView: (viewId: string) => void;
  saveCurrentView: (name: string) => void;
  deleteSavedView: (viewId: string) => void;
  contextLabel?: string;
}

const auditFields: DataViewFieldConfig<AuditFilters>[] = [
  { key: "target_identifier__icontains", label: "Target", placeholder: "Search username or email" },
  { key: "action_type", label: "Action", placeholder: "MEMBERSHIP_UPDATED" },
];

export function AccessAuditTable({
  auditQuery,
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
}: AccessAuditTableProps) {
  return (
    <ResourceTable
      columns={[
        { header: "Occurred", key: "occurred", render: (row) => row.occurred_at },
        { header: "Action", key: "action", render: (row) => row.action_type },
        { header: "Actor", key: "actor", render: (row) => row.actor_name },
        { header: "Target", key: "target", render: (row) => row.target_identifier || row.invite_email || row.username || "--" },
        { header: "Context", key: "context", render: (row) => JSON.stringify(row.payload) },
      ]}
      error={auditQuery.error ? parseApiError(auditQuery.error) : null}
      getRowId={(row) => row.id}
      isLoading={auditQuery.isLoading}
      pagination={{
        page,
        pageSize,
        total: auditQuery.data?.count ?? 0,
        onPageChange: setPage,
      }}
      rows={auditQuery.data?.results ?? []}
      subtitle="Access-management change log for invites, password resets, company switching, and browser account updates."
      title="Access audit"
      toolbar={
        <DataViewToolbar
          activeFilterCount={activeFilterCount}
          contextLabel={contextLabel}
          fields={auditFields}
          filters={filters}
          onChange={updateFilter}
          onReset={resetFilters}
          resultCount={auditQuery.data?.count}
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
