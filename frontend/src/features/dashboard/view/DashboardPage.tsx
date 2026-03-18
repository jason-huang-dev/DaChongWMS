import Grid from "@mui/material/Grid";
import { Button, ButtonGroup, Chip, List, ListItem, ListItemText, Stack, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";

import { useDashboardController } from "@/features/dashboard/controller/useDashboardController";
import { DashboardTable } from "@/features/dashboard/view/DashboardTable";
import { MetricCard } from "@/shared/components/metric-card";
import { PageHeader } from "@/shared/components/page-header";
import { WorkbenchPanel } from "@/shared/components/workbench-panel";
import { formatNumber } from "@/shared/utils/format";

const timeWindowOptions = [
  { label: "This week", value: "WEEK" },
  { label: "This month", value: "MONTH" },
  { label: "This year", value: "YEAR" },
] as const;

export function DashboardPage() {
  const navigate = useNavigate();
  const {
    company,
    canViewOps,
    canViewFinance,
    balancesQuery,
    purchaseOrdersQuery,
    salesOrdersQuery,
    approvalsSummaryQuery,
    countingDashboardQuery,
    invoicesQuery,
    firstWarehouse,
    visibleOnHand,
    timeWindow,
    updateWorkbenchPreference,
    visibleWidgetKeys,
    rightRailWidgetKeys,
  } = useDashboardController();

  const visibleWidgets = new Set(visibleWidgetKeys.length > 0 ? visibleWidgetKeys : ["metrics", "ops-summary", "queues"]);
  const rightRailWidgets = new Set(rightRailWidgetKeys.length > 0 ? rightRailWidgetKeys : ["scope", "alerts", "help"]);

  return (
    <Stack spacing={3}>
      <PageHeader
        actions={
          <Stack alignItems={{ sm: "center" }} direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <ButtonGroup color="inherit" size="small" variant="outlined">
              {timeWindowOptions.map((option) => (
                <Button
                  key={option.value}
                  onClick={() => updateWorkbenchPreference.mutate({ time_window: option.value })}
                  variant={timeWindow === option.value ? "contained" : "outlined"}
                >
                  {option.label}
                </Button>
              ))}
            </ButtonGroup>
            {canViewOps ? (
              <>
                <Button onClick={() => navigate("/inbound")} variant="contained">
                  Receive
                </Button>
                <Button onClick={() => navigate("/outbound")} variant="outlined">
                  Ship
                </Button>
              </>
            ) : null}
          </Stack>
        }
        description={`Operator workbench for ${company?.label ?? "the current tenant"}. The current workbench preference persists the selected time window and layout choices.`}
        title="Operations workbench"
      />
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, xl: 8 }}>
          <Stack spacing={2.5}>
            {visibleWidgets.has("metrics") ? (
              <Grid container spacing={2.5}>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                  <MetricCard
                    helper={firstWarehouse ? `${firstWarehouse.warehouse_city} | ${firstWarehouse.warehouse_manager}` : "No warehouse configured yet."}
                    label="Active warehouse"
                    value={firstWarehouse?.warehouse_name ?? "--"}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                  <MetricCard
                    helper={canViewOps ? `${formatNumber(visibleOnHand)} visible units in the current scope.` : "Requires an operations role."}
                    label="Visible on-hand"
                    value={canViewOps ? formatNumber(visibleOnHand) : "Restricted"}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                  <MetricCard
                    helper="Open supervisor approvals for count variances."
                    label="Pending approvals"
                    value={canViewOps ? approvalsSummaryQuery.data?.pending_count ?? "--" : "Restricted"}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                  <MetricCard
                    helper={canViewFinance ? `${invoicesQuery.data?.count ?? 0} invoices in finance scope.` : "Requires finance visibility."}
                    label="Finance invoices"
                    value={canViewFinance ? invoicesQuery.data?.count ?? "--" : "Restricted"}
                  />
                </Grid>
              </Grid>
            ) : null}

            {visibleWidgets.has("ops-summary") ? (
              <WorkbenchPanel
                actions={<Chip color="primary" label={timeWindowOptions.find((option) => option.value === timeWindow)?.label ?? "This week"} variant="outlined" />}
                subtitle="Use this as the daily control point before dropping into a specific queue."
                title="Queue focus"
              >
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <MetricCard
                      helper="Purchase orders waiting to be received."
                      label="Inbound queue"
                      value={purchaseOrdersQuery.data?.count ?? "--"}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <MetricCard
                      helper="Sales orders waiting for pick or ship activity."
                      label="Outbound queue"
                      value={salesOrdersQuery.data?.count ?? "--"}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <MetricCard
                      helper="Rejected variances that still require recount attention."
                      label="Rejected variances"
                      value={approvalsSummaryQuery.data?.rejected_count ?? "--"}
                    />
                  </Grid>
                </Grid>
              </WorkbenchPanel>
            ) : null}

            {visibleWidgets.has("queues") ? (
              <DashboardTable
                canViewFinance={canViewFinance}
                canViewOps={canViewOps}
                invoicesQuery={invoicesQuery}
                purchaseOrdersQuery={purchaseOrdersQuery}
                salesOrdersQuery={salesOrdersQuery}
              />
            ) : null}
          </Stack>
        </Grid>
        <Grid size={{ xs: 12, xl: 4 }}>
          <Stack spacing={2.5}>
            {rightRailWidgets.has("scope") ? (
              <WorkbenchPanel subtitle="Company and warehouse context for every queue below." title="Scope and context">
                <List dense disablePadding>
                  <ListItem disableGutters>
                    <ListItemText primary="Workspace" secondary={company?.label ?? "Current tenant"} />
                  </ListItem>
                  <ListItem disableGutters>
                    <ListItemText primary="Warehouse" secondary={firstWarehouse?.warehouse_name ?? "No warehouse configured"} />
                  </ListItem>
                  <ListItem disableGutters>
                    <ListItemText primary="Workbench window" secondary={timeWindowOptions.find((option) => option.value === timeWindow)?.label ?? "This week"} />
                  </ListItem>
                </List>
              </WorkbenchPanel>
            ) : null}

            {rightRailWidgets.has("alerts") ? (
              <WorkbenchPanel subtitle="These are the exception queues worth clearing first." title="Exception watchlist">
                <Stack spacing={1}>
                  <Chip label={`Approval SLA breaches: ${countingDashboardQuery.data?.pending_sla_breach_count ?? 0}`} variant="outlined" />
                  <Chip label={`Recount SLA breaches: ${countingDashboardQuery.data?.recount_sla_breach_count ?? 0}`} variant="outlined" />
                  <Chip label={`Loaded invoices: ${invoicesQuery.data?.count ?? 0}`} variant="outlined" />
                </Stack>
              </WorkbenchPanel>
            ) : null}

            {rightRailWidgets.has("help") ? (
              <WorkbenchPanel subtitle="Keep help and escalation one click away on dense operator pages." title="Operator help">
                <Stack spacing={1.5}>
                  <Typography variant="body2">- Receive issues: verify ASN / PO first, then confirm lot and LPN state.</Typography>
                  <Typography variant="body2">- Ship issues: clear short picks before closing dock-load verification.</Typography>
                  <Typography variant="body2">- Access issues: managers can issue invites and resets from Security.</Typography>
                </Stack>
              </WorkbenchPanel>
            ) : null}
          </Stack>
        </Grid>
      </Grid>
    </Stack>
  );
}
