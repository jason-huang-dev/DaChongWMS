import Grid from "@mui/material/Grid";
import { Box } from "@mui/material";

import type {
  ReturnDispositionRecord,
  ReturnOrderRecord,
  ReturnReceiptRecord,
} from "@/features/returns/model/types";
import { DataViewToolbar, type DataViewFieldConfig } from "@/shared/components/data-view-toolbar";
import { RecordLink } from "@/shared/components/record-link";
import { ResourceTable } from "@/shared/components/resource-table";
import type { UseDataViewResult } from "@/shared/hooks/use-data-view";
import { StatusChip } from "@/shared/components/status-chip";
import type { PaginatedQueryState } from "@/shared/types/query";
import { formatDateTime, formatNumber } from "@/shared/utils/format";
import { parseApiError } from "@/shared/utils/parse-api-error";

const returnOrderFields: DataViewFieldConfig<{ return_number__icontains: string; status: string }>[] = [
  { key: "return_number__icontains", label: "Return", placeholder: "RMA-1001" },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { label: "Open", value: "OPEN" },
      { label: "Partial received", value: "PARTIAL_RECEIVED" },
      { label: "Received", value: "RECEIVED" },
      { label: "Partial disposed", value: "PARTIAL_DISPOSED" },
      { label: "Completed", value: "COMPLETED" },
      { label: "Cancelled", value: "CANCELLED" },
    ],
  },
];

const receiptFields: DataViewFieldConfig<{ receipt_number__icontains: string; stock_status: string }>[] = [
  { key: "receipt_number__icontains", label: "Receipt", placeholder: "RTR-1001" },
  {
    key: "stock_status",
    label: "Stock status",
    type: "select",
    options: [
      { label: "Available", value: "AVAILABLE" },
      { label: "Damaged", value: "DAMAGED" },
      { label: "Hold", value: "HOLD" },
    ],
  },
];

const dispositionFields: DataViewFieldConfig<{ disposition_number__icontains: string; disposition_type: string }>[] = [
  { key: "disposition_number__icontains", label: "Disposition", placeholder: "DSP-1001" },
  {
    key: "disposition_type",
    label: "Type",
    type: "select",
    options: [
      { label: "Restock", value: "RESTOCK" },
      { label: "Quarantine", value: "QUARANTINE" },
      { label: "Scrap", value: "SCRAP" },
    ],
  },
];

interface ReturnsTableProps {
  activeWarehouseName?: string | null;
  returnOrdersQuery: PaginatedQueryState<ReturnOrderRecord>;
  returnOrdersView: UseDataViewResult<{ return_number__icontains: string; status: string; status__in: string }>;
  receiptsQuery: PaginatedQueryState<ReturnReceiptRecord>;
  receiptsView: UseDataViewResult<{ receipt_number__icontains: string; stock_status: string }>;
  dispositionsQuery: PaginatedQueryState<ReturnDispositionRecord>;
  dispositionsView: UseDataViewResult<{ disposition_number__icontains: string; disposition_type: string }>;
}

export function ReturnsTable({
  activeWarehouseName,
  returnOrdersQuery,
  returnOrdersView,
  receiptsQuery,
  receiptsView,
  dispositionsQuery,
  dispositionsView,
}: ReturnsTableProps) {
  return (
    <Grid container spacing={2.5}>
      <Grid size={{ xs: 12 }}>
        <Box id="return-orders">
          <ResourceTable
            columns={[
              {
                header: "Return",
                key: "return",
                render: (row) => (
                  <RecordLink to={`/returns/return-orders/${row.id}`}>
                    {row.return_number}
                  </RecordLink>
                ),
              },
              { header: "Customer", key: "customer", render: (row) => row.customer_name },
              {
                header: "Sales order",
                key: "salesOrder",
                render: (row) => row.sales_order_number || "--",
              },
              { header: "Requested", key: "requested", render: (row) => formatDateTime(row.requested_date) },
              { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
            ]}
            error={returnOrdersQuery.error ? parseApiError(returnOrdersQuery.error) : null}
            getRowId={(row) => row.id}
            isLoading={returnOrdersQuery.isLoading}
            pagination={{
              page: returnOrdersView.page,
              pageSize: returnOrdersView.pageSize,
              total: returnOrdersQuery.data?.count ?? 0,
              onPageChange: returnOrdersView.setPage,
            }}
            rows={returnOrdersQuery.data?.results ?? []}
            subtitle="Expected customer returns by order"
            title="Return orders"
            toolbar={
              <DataViewToolbar
                activeFilterCount={returnOrdersView.activeFilterCount}
                contextLabel={activeWarehouseName ? `Warehouse: ${activeWarehouseName}` : "All warehouses"}
                fields={returnOrderFields}
                filters={returnOrdersView.filters}
                onChange={returnOrdersView.updateFilter}
                onReset={returnOrdersView.resetFilters}
                resultCount={returnOrdersQuery.data?.count}
                savedViews={{
                  items: returnOrdersView.savedViews,
                  selectedId: returnOrdersView.selectedSavedViewId,
                  onApply: returnOrdersView.applySavedView,
                  onDelete: returnOrdersView.deleteSavedView,
                  onSave: returnOrdersView.saveCurrentView,
                }}
              />
            }
          />
        </Box>
      </Grid>
      <Grid size={{ xs: 12, xl: 6 }}>
        <Box id="return-receipts">
          <ResourceTable
            columns={[
              { header: "Receipt", key: "receipt", render: (row) => row.receipt_number },
              { header: "Return", key: "return", render: (row) => row.return_number },
              { header: "SKU", key: "sku", render: (row) => row.goods_code },
              { header: "Location", key: "location", render: (row) => row.receipt_location_code },
              { header: "Qty", key: "qty", align: "right", render: (row) => formatNumber(row.received_qty) },
              { header: "Received", key: "received", render: (row) => formatDateTime(row.received_at) },
            ]}
            error={receiptsQuery.error ? parseApiError(receiptsQuery.error) : null}
            getRowId={(row) => row.id}
            isLoading={receiptsQuery.isLoading}
            pagination={{
              page: receiptsView.page,
              pageSize: receiptsView.pageSize,
              total: receiptsQuery.data?.count ?? 0,
              onPageChange: receiptsView.setPage,
            }}
            rows={receiptsQuery.data?.results ?? []}
            subtitle="Posted warehouse receipts against return lines"
            title="Return receipts"
            toolbar={
              <DataViewToolbar
                activeFilterCount={receiptsView.activeFilterCount}
                contextLabel={activeWarehouseName ? `Warehouse: ${activeWarehouseName}` : "All warehouses"}
                fields={receiptFields}
                filters={receiptsView.filters}
                onChange={receiptsView.updateFilter}
                onReset={receiptsView.resetFilters}
                resultCount={receiptsQuery.data?.count}
                savedViews={{
                  items: receiptsView.savedViews,
                  selectedId: receiptsView.selectedSavedViewId,
                  onApply: receiptsView.applySavedView,
                  onDelete: receiptsView.deleteSavedView,
                  onSave: receiptsView.saveCurrentView,
                }}
              />
            }
          />
        </Box>
      </Grid>
      <Grid size={{ xs: 12, xl: 6 }}>
        <Box id="return-dispositions">
          <ResourceTable
            columns={[
              { header: "Disposition", key: "disposition", render: (row) => row.disposition_number },
              { header: "Return", key: "return", render: (row) => row.return_number },
              { header: "Receipt", key: "receipt", render: (row) => row.receipt_number },
              { header: "Type", key: "type", render: (row) => row.disposition_type },
              { header: "Qty", key: "qty", align: "right", render: (row) => formatNumber(row.quantity) },
              { header: "Completed", key: "completed", render: (row) => formatDateTime(row.completed_at) },
            ]}
            error={dispositionsQuery.error ? parseApiError(dispositionsQuery.error) : null}
            getRowId={(row) => row.id}
            isLoading={dispositionsQuery.isLoading}
            pagination={{
              page: dispositionsView.page,
              pageSize: dispositionsView.pageSize,
              total: dispositionsQuery.data?.count ?? 0,
              onPageChange: dispositionsView.setPage,
            }}
            rows={dispositionsQuery.data?.results ?? []}
            subtitle="Final handling outcome for received return stock"
            title="Return dispositions"
            toolbar={
              <DataViewToolbar
                activeFilterCount={dispositionsView.activeFilterCount}
                contextLabel={activeWarehouseName ? `Warehouse: ${activeWarehouseName}` : "All warehouses"}
                fields={dispositionFields}
                filters={dispositionsView.filters}
                onChange={dispositionsView.updateFilter}
                onReset={dispositionsView.resetFilters}
                resultCount={dispositionsQuery.data?.count}
                savedViews={{
                  items: dispositionsView.savedViews,
                  selectedId: dispositionsView.selectedSavedViewId,
                  onApply: dispositionsView.applySavedView,
                  onDelete: dispositionsView.deleteSavedView,
                  onSave: dispositionsView.saveCurrentView,
                }}
              />
            }
          />
        </Box>
      </Grid>
    </Grid>
  );
}
