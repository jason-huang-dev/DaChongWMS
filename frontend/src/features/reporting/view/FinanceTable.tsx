import { DataViewToolbar, type DataViewFieldConfig } from "@/shared/components/data-view-toolbar";
import { RecordLink } from "@/shared/components/record-link";
import { ResourceTable } from "@/shared/components/resource-table";
import { StatusChip } from "@/shared/components/status-chip";
import type { UseDataViewResult } from "@/shared/hooks/use-data-view";
import type { InvoiceRecord } from "@/features/reporting/model/types";
import { formatDateTime, formatNumber } from "@/shared/utils/format";

import { sumInvoiceAmounts } from "../model/mappers";

const invoiceFields: DataViewFieldConfig<{ invoice_number__icontains: string; status: string }>[] = [
  { key: "invoice_number__icontains", label: "Invoice", placeholder: "INV-1001" },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { label: "Draft", value: "DRAFT" },
      { label: "Finalized", value: "FINALIZED" },
      { label: "Void", value: "VOID" },
    ],
  },
];

interface FinanceTableProps {
  rows: InvoiceRecord[];
  isLoading: boolean;
  error?: string | null;
  total: number;
  activeWarehouseName?: string | null;
  dataView: UseDataViewResult<{ invoice_number__icontains: string; status: string }>;
}

export function FinanceTable({ rows, isLoading, error, total, activeWarehouseName, dataView }: FinanceTableProps) {
  return (
    <ResourceTable
      columns={[
        {
          header: "Invoice",
          key: "invoice",
          render: (row) => <RecordLink to={`/finance/invoices/${row.id}`}>{row.invoice_number}</RecordLink>,
        },
        { header: "Issue date", key: "issueDate", render: (row) => formatDateTime(row.generated_at || row.issue_date) },
        { header: "Total", key: "total", align: "right", render: (row) => `${formatNumber(row.total_amount)} ${row.currency}` },
        {
          header: "Disputed",
          key: "disputed",
          align: "right",
          render: (row) => formatNumber(row.disputed_amount ?? sumInvoiceAmounts(row.disputes ?? [], "disputed_amount")),
        },
        {
          header: "Credited",
          key: "credited",
          align: "right",
          render: (row) => formatNumber(row.credited_amount ?? sumInvoiceAmounts(row.credit_notes ?? [], "amount")),
        },
        { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
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
      rows={rows}
      subtitle="Invoice ledger generated from rate contracts and charge events"
      title="Invoices"
      toolbar={
        <DataViewToolbar
          activeFilterCount={dataView.activeFilterCount}
          contextLabel={activeWarehouseName ? `Warehouse: ${activeWarehouseName}` : "All warehouses"}
          fields={invoiceFields}
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
