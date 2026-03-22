import { Button } from "@mui/material";

import type { ClientAccountRecord } from "@/features/clients/model/types";
import { DataViewToolbar, type DataViewFieldConfig } from "@/shared/components/data-view-toolbar";
import { ResourceTable } from "@/shared/components/resource-table";
import type { UseDataViewResult } from "@/shared/hooks/use-data-view";

const clientFields: DataViewFieldConfig<{
  name: string;
  code: string;
  is_active: string;
  allow_dropshipping_orders: string;
  allow_inbound_goods: string;
}>[] = [
  { key: "name", label: "Client", placeholder: "Acme Retail" },
  { key: "code", label: "Code", placeholder: "ACM-1" },
  {
    key: "is_active",
    label: "Status",
    type: "select",
    options: [
      { label: "Active", value: "true" },
      { label: "Inactive", value: "false" },
    ],
  },
  {
    key: "allow_dropshipping_orders",
    label: "Dropship orders",
    type: "select",
    options: [
      { label: "Enabled", value: "true" },
      { label: "Disabled", value: "false" },
    ],
  },
  {
    key: "allow_inbound_goods",
    label: "Inbound goods",
    type: "select",
    options: [
      { label: "Enabled", value: "true" },
      { label: "Disabled", value: "false" },
    ],
  },
];

interface ClientAccountTableProps {
  clients: ClientAccountRecord[];
  total: number;
  isLoading: boolean;
  error?: string | null;
  companyLabel?: string | null;
  activeWarehouseName?: string | null;
  dataView: UseDataViewResult<{
    name: string;
    code: string;
    is_active: string;
    allow_dropshipping_orders: string;
    allow_inbound_goods: string;
  }>;
  onEdit: (client: ClientAccountRecord) => void;
}

function yesNoLabel(value: boolean) {
  return value ? "Enabled" : "Disabled";
}

export function ClientAccountTable({
  clients,
  total,
  isLoading,
  error,
  companyLabel,
  activeWarehouseName,
  dataView,
  onEdit,
}: ClientAccountTableProps) {
  const contextParts = [
    companyLabel ? `Workspace: ${companyLabel}` : null,
    activeWarehouseName ? `Warehouse context: ${activeWarehouseName}` : null,
  ].filter(Boolean);

  return (
    <ResourceTable
      columns={[
        { header: "Client", key: "name", render: (row) => row.name },
        { header: "Code", key: "code", render: (row) => row.code },
        { header: "Contact", key: "contact", render: (row) => row.contact_name || row.contact_email || "--" },
        { header: "Billing", key: "billing", render: (row) => row.billing_email || "--" },
        { header: "Shipping", key: "shipping", render: (row) => row.shipping_method || "--" },
        { header: "Dropship orders", key: "dropship", render: (row) => yesNoLabel(row.allow_dropshipping_orders) },
        { header: "Inbound goods", key: "inbound", render: (row) => yesNoLabel(row.allow_inbound_goods) },
        { header: "Status", key: "status", render: (row) => (row.is_active ? "Active" : "Inactive") },
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
      error={error}
      getRowId={(row) => row.id}
      isLoading={isLoading}
      pagination={{
        page: dataView.page,
        pageSize: dataView.pageSize,
        total,
        onPageChange: dataView.setPage,
      }}
      rows={clients}
      subtitle="Operational client accounts used for dropshipping order intake, billing contact, and inbound submission rights."
      title="Client accounts"
      toolbar={
        <DataViewToolbar
          activeFilterCount={dataView.activeFilterCount}
          contextLabel={contextParts.join(" | ") || undefined}
          fields={clientFields}
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
