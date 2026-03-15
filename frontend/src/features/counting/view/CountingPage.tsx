import Grid from "@mui/material/Grid";
import { Stack } from "@mui/material";

import { useCountingController } from "@/features/counting/controller/useCountingController";
import { CountingTable } from "@/features/counting/view/CountingTable";
import { ScannerTaskPanel } from "@/features/counting/view/components/ScannerTaskPanel";
import { MetricCard } from "@/shared/components/metric-card";
import { PageHeader } from "@/shared/components/page-header";
import { RecordLink } from "@/shared/components/record-link";
import { ResourceTable } from "@/shared/components/resource-table";
import { StatusChip } from "@/shared/components/status-chip";
import { formatDateTime, formatNumber } from "@/shared/utils/format";
import { parseApiError } from "@/shared/utils/parse-api-error";

export function CountingPage() {
  const { assignmentsQuery, dashboardQuery, nextTaskQuery, pageSize, queuePage, queueQuery, setQueuePage } =
    useCountingController();

  return (
    <Stack spacing={3}>
      <PageHeader
        description="Assignment visibility for handheld counters plus scan-first task completion and the supervisor queue for variance approvals and recount breaches."
        title="Counting"
      />
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <MetricCard label="Pending approvals" value={dashboardQuery.data?.pending_total ?? "--"} />
        </Grid>
        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <MetricCard label="Approval SLA breaches" value={dashboardQuery.data?.pending_sla_breach_count ?? "--"} />
        </Grid>
        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <MetricCard label="Recount SLA breaches" value={dashboardQuery.data?.recount_sla_breach_count ?? "--"} />
        </Grid>
        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <MetricCard
            helper={nextTaskQuery.data ? `${nextTaskQuery.data.location_code} | ${nextTaskQuery.data.goods_code}` : "No scanner task currently assigned."}
            label="Next handheld task"
            value={nextTaskQuery.data?.task_type ?? "--"}
          />
        </Grid>
      </Grid>
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12 }}>
          <ScannerTaskPanel
            errorMessage={nextTaskQuery.isError ? parseApiError(nextTaskQuery.error) : null}
            isLoading={nextTaskQuery.isLoading}
            task={nextTaskQuery.data}
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 6 }}>
          <ResourceTable
            columns={[
              { header: "Count line", key: "line", render: (row) => `${row.cycle_count}-${row.line_number}` },
              { header: "Location", key: "location", render: (row) => row.location_code },
              { header: "SKU", key: "sku", render: (row) => row.goods_code },
              { header: "Task", key: "task", render: (row) => row.scanner_task_type || "COUNT" },
              { header: "Task status", key: "taskStatus", render: (row) => <StatusChip status={row.scanner_task_status || row.status} /> },
              { header: "Counted qty", key: "counted", align: "right", render: (row) => formatNumber(row.counted_qty) },
            ]}
            error={assignmentsQuery.error ? parseApiError(assignmentsQuery.error) : null}
            getRowId={(row) => row.id}
            isLoading={assignmentsQuery.isLoading}
            rows={assignmentsQuery.data?.results ?? []}
            subtitle="Current counter assignments for the logged-in operator"
            title="My assignments"
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 6 }}>
          <ResourceTable
            columns={[
              {
                header: "Count",
                key: "count",
                render: (row) => <RecordLink to={`/counting/approvals/${row.approval_id}`}>{row.count_number}</RecordLink>,
              },
              { header: "Warehouse", key: "warehouse", render: (row) => row.warehouse_name },
              { header: "Location", key: "location", render: (row) => row.location_code },
              { header: "SKU", key: "sku", render: (row) => row.goods_code },
              { header: "Variance", key: "variance", align: "right", render: (row) => formatNumber(row.variance_qty) },
              { header: "Required role", key: "role", render: (row) => row.required_role },
              { header: "Age", key: "age", align: "right", render: (row) => `${row.age_hours.toFixed(1)}h` },
            ]}
            error={dashboardQuery.error ? parseApiError(dashboardQuery.error) : null}
            getRowId={(row) => row.approval_id}
            isLoading={dashboardQuery.isLoading}
            rows={dashboardQuery.data?.pending_oldest_items ?? []}
            subtitle="Oldest pending approvals from the supervisor dashboard"
            title="Pending approvals at risk"
          />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <CountingTable
            error={queueQuery.error ? parseApiError(queueQuery.error) : null}
            isLoading={queueQuery.isLoading}
            onPageChange={setQueuePage}
            page={queuePage}
            pageSize={pageSize}
            rows={queueQuery.data?.results ?? []}
            total={queueQuery.data?.count ?? 0}
          />
        </Grid>
      </Grid>
    </Stack>
  );
}
