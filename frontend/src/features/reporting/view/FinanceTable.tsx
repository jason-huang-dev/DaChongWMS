import { RecordLink } from "@/shared/components/record-link";
import { ResourceTable } from "@/shared/components/resource-table";
import { StatusChip } from "@/shared/components/status-chip";
import type { InvoiceRecord } from "@/features/reporting/model/types";
import { formatDateTime, formatNumber } from "@/shared/utils/format";

import { sumInvoiceAmounts } from "../model/mappers";

interface FinanceTableProps {
  rows: InvoiceRecord[];
  isLoading: boolean;
  error?: string | null;
}

export function FinanceTable({ rows, isLoading, error }: FinanceTableProps) {
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
      rows={rows}
      subtitle="Invoice ledger generated from rate contracts and charge events"
      title="Invoices"
    />
  );
}
