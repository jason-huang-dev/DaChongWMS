import { Button } from "@mui/material";

import type { ProductRecord } from "@/features/products/model/types";
import { DataViewToolbar, type DataViewFieldConfig } from "@/shared/components/data-view-toolbar";
import { ResourceTable } from "@/shared/components/resource-table";
import type { UseDataViewResult } from "@/shared/hooks/use-data-view";

const productFields: DataViewFieldConfig<{
  name: string;
  sku: string;
  is_active: string;
}>[] = [
  { key: "name", label: "Product", placeholder: "Bluetooth Scanner" },
  { key: "sku", label: "SKU", placeholder: "SKU-001" },
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

interface ProductTableProps {
  products: ProductRecord[];
  total: number;
  isLoading: boolean;
  error?: string | null;
  companyLabel?: string | null;
  dataView: UseDataViewResult<{
    name: string;
    sku: string;
    is_active: string;
  }>;
  onEdit: (product: ProductRecord) => void;
}

export function ProductTable({
  products,
  total,
  isLoading,
  error,
  companyLabel,
  dataView,
  onEdit,
}: ProductTableProps) {
  return (
    <ResourceTable
      columns={[
        { header: "SKU", key: "sku", render: (row) => row.sku },
        { header: "Product", key: "name", render: (row) => row.name },
        { header: "UOM", key: "uom", render: (row) => row.unit_of_measure },
        { header: "Category", key: "category", render: (row) => row.category || "--" },
        { header: "Brand", key: "brand", render: (row) => row.brand || "--" },
        { header: "Status", key: "status", render: (row) => (row.is_active ? "Active" : "Inactive") },
        {
          header: "Action",
          key: "action",
          render: (row) => (
            <Button onClick={() => onEdit(row)} size="small" variant="outlined">
              Manage
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
      rows={products}
      subtitle="Select a product to manage client distribution mappings, serial tracking, packaging, and marks."
      title="Products"
      toolbar={
        <DataViewToolbar
          activeFilterCount={dataView.activeFilterCount}
          contextLabel={companyLabel ? `Workspace: ${companyLabel}` : undefined}
          fields={productFields}
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
