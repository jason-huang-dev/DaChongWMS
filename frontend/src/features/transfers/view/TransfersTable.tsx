import Grid from "@mui/material/Grid";
import { Button } from "@mui/material";

import type {
  ReplenishmentRuleRecord,
  ReplenishmentTaskRecord,
  TransferLineRecord,
  TransferOrderRecord,
} from "@/features/transfers/model/types";
import { RecordLink } from "@/shared/components/record-link";
import { ResourceTable } from "@/shared/components/resource-table";
import { StatusChip } from "@/shared/components/status-chip";
import type { PaginatedQueryState } from "@/shared/types/query";
import { formatDateTime, formatNumber } from "@/shared/utils/format";
import { parseApiError } from "@/shared/utils/parse-api-error";

interface TransfersTableProps {
  transferOrdersQuery: PaginatedQueryState<TransferOrderRecord>;
  transferLinesQuery: PaginatedQueryState<TransferLineRecord>;
  replenishmentRulesQuery: PaginatedQueryState<ReplenishmentRuleRecord>;
  replenishmentTasksQuery: PaginatedQueryState<ReplenishmentTaskRecord>;
  isGeneratingTask: boolean;
  isCompletingTask: boolean;
  onGenerateTask: (replenishmentRuleId: number) => void;
  onCompleteTask: (replenishmentTaskId: number) => void;
}

export function TransfersTable({
  transferOrdersQuery,
  transferLinesQuery,
  replenishmentRulesQuery,
  replenishmentTasksQuery,
  isGeneratingTask,
  isCompletingTask,
  onGenerateTask,
  onCompleteTask,
}: TransfersTableProps) {
  return (
    <Grid container spacing={2.5}>
      <Grid size={{ xs: 12 }}>
        <ResourceTable
          columns={[
            {
              header: "Transfer",
              key: "transfer",
              render: (row) => (
                <RecordLink to={`/transfers/transfer-orders/${row.id}`}>
                  {row.transfer_number}
                </RecordLink>
              ),
            },
            { header: "Warehouse", key: "warehouse", render: (row) => row.warehouse_name },
            { header: "Requested", key: "requested", render: (row) => formatDateTime(row.requested_date) },
            { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
          ]}
          error={transferOrdersQuery.error ? parseApiError(transferOrdersQuery.error) : null}
          getRowId={(row) => row.id}
          isLoading={transferOrdersQuery.isLoading}
          rows={transferOrdersQuery.data?.results ?? []}
          subtitle="Planned internal stock moves across warehouse locations"
          title="Transfer orders"
        />
      </Grid>
      <Grid size={{ xs: 12, xl: 6 }}>
        <ResourceTable
          columns={[
            { header: "Line", key: "line", render: (row) => `${row.transfer_order}-${row.line_number}` },
            { header: "SKU", key: "sku", render: (row) => row.goods_code },
            { header: "From", key: "from", render: (row) => row.from_location_code },
            { header: "To", key: "to", render: (row) => row.to_location_code },
            { header: "Qty", key: "qty", align: "right", render: (row) => formatNumber(row.requested_qty) },
            { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
          ]}
          error={transferLinesQuery.error ? parseApiError(transferLinesQuery.error) : null}
          getRowId={(row) => row.id}
          isLoading={transferLinesQuery.isLoading}
          rows={transferLinesQuery.data?.results ?? []}
          subtitle="Transfer execution lines derived from transfer orders"
          title="Transfer lines"
        />
      </Grid>
      <Grid size={{ xs: 12, xl: 6 }}>
        <ResourceTable
          columns={[
            { header: "SKU", key: "sku", render: (row) => row.goods_code },
            { header: "Source", key: "source", render: (row) => row.source_location_code },
            { header: "Target", key: "target", render: (row) => row.target_location_code },
            { header: "Min", key: "min", align: "right", render: (row) => formatNumber(row.minimum_qty) },
            {
              header: "Target qty",
              key: "targetQty",
              align: "right",
              render: (row) => formatNumber(row.target_qty),
            },
            { header: "Priority", key: "priority", align: "right", render: (row) => row.priority },
            {
              header: "Action",
              key: "action",
              render: (row) => (
                <Button
                  disabled={isGeneratingTask || !row.is_active}
                  onClick={() => onGenerateTask(row.id)}
                  size="small"
                  variant="outlined"
                >
                  Generate task
                </Button>
              ),
            },
          ]}
          error={replenishmentRulesQuery.error ? parseApiError(replenishmentRulesQuery.error) : null}
          getRowId={(row) => row.id}
          isLoading={replenishmentRulesQuery.isLoading}
          rows={replenishmentRulesQuery.data?.results ?? []}
          subtitle="Min-max replenishment rules for forward locations"
          title="Replenishment rules"
        />
      </Grid>
      <Grid size={{ xs: 12 }}>
        <ResourceTable
          columns={[
            { header: "Task", key: "task", render: (row) => row.task_number },
            { header: "SKU", key: "sku", render: (row) => row.goods_code },
            { header: "From", key: "from", render: (row) => row.from_location_code },
            { header: "To", key: "to", render: (row) => row.to_location_code },
            { header: "Generated", key: "generated", render: (row) => formatDateTime(row.generated_at) },
            { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
            {
              header: "Action",
              key: "action",
              render: (row) => (
                <Button
                  disabled={isCompletingTask || row.status === "COMPLETED"}
                  onClick={() => onCompleteTask(row.id)}
                  size="small"
                  variant="contained"
                >
                  Complete
                </Button>
              ),
            },
          ]}
          error={replenishmentTasksQuery.error ? parseApiError(replenishmentTasksQuery.error) : null}
          getRowId={(row) => row.id}
          isLoading={replenishmentTasksQuery.isLoading}
          rows={replenishmentTasksQuery.data?.results ?? []}
          subtitle="Generated replenishment work ready for completion"
          title="Replenishment tasks"
        />
      </Grid>
    </Grid>
  );
}
