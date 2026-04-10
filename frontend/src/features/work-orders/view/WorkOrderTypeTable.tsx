import { Button } from "@mui/material";

import { useI18n } from "@/app/ui-preferences";
import type { WorkOrderTypeRecord } from "@/features/work-orders/model/types";
import { DataViewToolbar, type DataViewFieldConfig } from "@/shared/components/data-view-toolbar";
import { ResourceTable } from "@/shared/components/resource-table";
import type { UseDataViewResult } from "@/shared/hooks/use-data-view";

const workOrderTypeFields: DataViewFieldConfig<{
  name: string;
  code: string;
  workstream: string;
  is_active: string;
}>[] = [
  { key: "name", label: "Type", placeholder: "Dropship rush" },
  { key: "code", label: "Code", placeholder: "dropship-rush" },
  {
    key: "workstream",
    label: "Workstream",
    type: "select",
    options: [
      { label: "Inbound", value: "INBOUND" },
      { label: "Outbound", value: "OUTBOUND" },
      { label: "Inventory", value: "INVENTORY" },
      { label: "Returns", value: "RETURNS" },
      { label: "General", value: "GENERAL" },
    ],
  },
  {
    key: "is_active",
    label: "Status",
    type: "select",
    options: [
      { label: "Active", value: "true" },
      { label: "Inactive", value: "false" },
    ],
  },
];

interface WorkOrderTypeTableProps {
  workOrderTypes: WorkOrderTypeRecord[];
  total: number;
  isLoading: boolean;
  error?: string | null;
  dataView: UseDataViewResult<{
    name: string;
    code: string;
    workstream: string;
    is_active: string;
  }>;
  onEdit: (workOrderType: WorkOrderTypeRecord) => void;
}

export function WorkOrderTypeTable({
  workOrderTypes,
  total,
  isLoading,
  error,
  dataView,
  onEdit,
}: WorkOrderTypeTableProps) {
  const { t, translate, msg } = useI18n();

  return (
    <ResourceTable
      columns={[
        { header: "Type", key: "name", render: (row) => row.name },
        { header: "Code", key: "code", render: (row) => row.code },
        { header: "Workstream", key: "workstream", render: (row) => t(row.workstream) },
        { header: "Default urgency", key: "urgency", render: (row) => t(row.default_urgency) },
        { header: "Default priority", key: "priority", render: (row) => String(row.default_priority_score) },
        { header: "SLA hours", key: "sla", render: (row) => String(row.target_sla_hours) },
        { header: "Status", key: "status", render: (row) => t(row.is_active ? "Active" : "Inactive") },
        {
          header: "Action",
          key: "action",
          render: (row) => (
            <Button onClick={() => onEdit(row)} size="small" variant="outlined">
              {t("Edit")}
            </Button>
          ),
        },
      ]}
      error={error}
      getRowId={(row) => row.id}
      isLoading={isLoading}
      pagination={{
        page: dataView.page,
        pageSize: dataView.pageSize,
        total,
        onPageChange: dataView.setPage,
      }}
      rows={workOrderTypes}
      subtitle="Reusable work-order templates that define urgency defaults and SLA expectations."
      title="Work order type management"
      toolbar={
        <DataViewToolbar
          activeFilterCount={dataView.activeFilterCount}
          fields={workOrderTypeFields}
          filters={dataView.filters}
          onChange={dataView.updateFilter}
          onReset={dataView.resetFilters}
          resultCount={total}
          savedViews={{
            items: dataView.savedViews,
            selectedId: dataView.selectedSavedViewId,
            onApply: dataView.applySavedView,
            onDelete: dataView.deleteSavedView,
            onSave: dataView.saveCurrentView,
          }}
        />
      }
    />
  );
}

