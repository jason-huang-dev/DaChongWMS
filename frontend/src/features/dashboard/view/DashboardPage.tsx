import Grid from "@mui/material/Grid";
import { Button, ButtonGroup, Chip, List, ListItem, ListItemText, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";

import { useDashboardController } from "@/features/dashboard/controller/useDashboardController";
import { DashboardTable } from "@/features/dashboard/view/DashboardTable";
import { DashboardQueueCard } from "@/features/dashboard/view/components/DashboardQueueCard";
import { MetricCard } from "@/shared/components/metric-card";
import { PageHeader } from "@/shared/components/page-header";
import { WorkbenchPanel } from "@/shared/components/workbench-panel";
import { formatNumber } from "@/shared/utils/format";

const timeWindowOptions = [
  { label: "This week", value: "WEEK" },
  { label: "This month", value: "MONTH" },
  { label: "This year", value: "YEAR" },
] as const;

function buildDashboardLink(
  pathname: string,
  query: Record<string, string | undefined> = {},
  hash?: string,
) {
  const searchParams = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value) {
      searchParams.set(key, value);
    }
  });

  const search = searchParams.toString();
  return `${pathname}${search ? `?${search}` : ""}${hash ? `#${hash}` : ""}`;
}

export function DashboardPage() {
  const navigate = useNavigate();
  const {
    activeWarehouse,
    activeWarehouseId,
    approvalsSummaryQuery,
    canViewFinance,
    canViewOps,
    company,
    countingDashboardQuery,
    invoicesQuery,
    purchaseOrdersQuery,
    queueMetrics,
    rightRailWidgetKeys,
    salesOrdersQuery,
    setActiveWarehouseId,
    timeWindow,
    updateWorkbenchPreference,
    visibleOnHand,
    visibleWidgetKeys,
    warehouses,
  } = useDashboardController();

  const visibleWidgets = new Set(visibleWidgetKeys.length > 0 ? visibleWidgetKeys : ["metrics", "ops-summary", "queues"]);
  const rightRailWidgets = new Set(rightRailWidgetKeys.length > 0 ? rightRailWidgetKeys : ["scope", "alerts", "help"]);

  const warehouseLabel = activeWarehouse?.warehouse_name ?? "No warehouse configured";

  const stockInMetrics = [
    {
      label: "Pending Stock In",
      value: canViewOps ? formatNumber(queueMetrics.stockIn.pendingStockIn) : "Restricted",
      to: canViewOps ? buildDashboardLink("/inbound", { poStatuses: "OPEN,PARTIAL" }, "purchase-orders") : undefined,
    },
    {
      label: "In Transit",
      value: canViewOps ? formatNumber(queueMetrics.stockIn.inTransit) : "Restricted",
      to: canViewOps ? buildDashboardLink("/inbound", { asnStatuses: "OPEN,PARTIAL" }, "advance-shipment-notices") : undefined,
    },
    {
      label: "Stocking In",
      value: canViewOps ? formatNumber(queueMetrics.stockIn.stockingIn) : "Restricted",
      to: canViewOps ? buildDashboardLink("/inbound", { putawayStatuses: "OPEN,ASSIGNED" }, "putaway-tasks") : undefined,
    },
  ];

  const outboundMetrics = [
    {
      label: "To Generate / In Process",
      value: canViewOps ? formatNumber(queueMetrics.outbound.toGenerateInProcess) : "Restricted",
      to: canViewOps ? buildDashboardLink("/outbound", { salesOrderStage: "IN_PROCESS" }, "package-management") : undefined,
    },
    {
      label: "To Ship",
      value: canViewOps ? formatNumber(queueMetrics.outbound.toShip) : "Restricted",
      to: canViewOps ? buildDashboardLink("/outbound", { salesOrderStage: "TO_SHIP", waybillPrinted: "true" }, "package-management") : undefined,
    },
    {
      label: "Get Tracking No",
      value: canViewOps ? formatNumber(queueMetrics.outbound.getTrackingNo) : "Restricted",
      to: canViewOps ? buildDashboardLink("/outbound", { salesOrderStage: "GET_TRACKING_NO" }, "package-management") : undefined,
    },
    {
      label: "To Move",
      value: canViewOps ? formatNumber(queueMetrics.outbound.toMove) : "Restricted",
      to: canViewOps ? buildDashboardLink("/outbound", { salesOrderStage: "TO_MOVE" }, "package-management") : undefined,
    },
    {
      label: "To Pick",
      value: canViewOps ? formatNumber(queueMetrics.outbound.toPick) : "Restricted",
      to: canViewOps ? buildDashboardLink("/outbound", { pickTaskStatuses: "OPEN,ASSIGNED" }, "secondary-picking") : undefined,
    },
    {
      label: "To Print & Stock-Out",
      value: canViewOps ? formatNumber(queueMetrics.outbound.toPrintAndStockOut) : "Restricted",
      to: canViewOps ? buildDashboardLink("/outbound", { salesOrderStage: "TO_SHIP", waybillPrinted: "false" }, "package-management") : undefined,
    },
    {
      label: "Abnormal",
      value: canViewOps ? formatNumber(queueMetrics.outbound.abnormal) : "Restricted",
      to: canViewOps ? buildDashboardLink("/outbound", { salesOrderException: "ABNORMAL_PACKAGE" }, "abnormal-package") : undefined,
    },
    {
      label: "Order Interception",
      value: canViewOps ? formatNumber(queueMetrics.outbound.orderInterception) : "Restricted",
      to: canViewOps ? buildDashboardLink("/outbound", { salesOrderException: "ORDER_INTERCEPTION" }, "interception-manage") : undefined,
    },
  ];

  const dispatchMetrics = [
    {
      label: "Shipped",
      value: canViewOps ? formatNumber(queueMetrics.dispatch.shipped) : "Restricted",
      to: canViewOps ? buildDashboardLink("/outbound", { shipmentStatus: "POSTED" }, "shipping-manage") : undefined,
    },
    {
      label: "Not Shipped",
      value: canViewOps ? formatNumber(queueMetrics.dispatch.notShipped) : "Restricted",
      to: canViewOps ? buildDashboardLink("/outbound", { salesOrderStatuses: "OPEN,ALLOCATED,PICKING,PICKED" }, "package-management") : undefined,
    },
    {
      label: "Order Cancellation",
      value: canViewOps ? formatNumber(queueMetrics.dispatch.orderCancellation) : "Restricted",
      to: canViewOps ? buildDashboardLink("/outbound", { salesOrderStatus: "CANCELLED" }, "package-management") : undefined,
    },
  ];

  const returnMetrics = [
    {
      label: "Pending Stock-in",
      value: canViewOps ? formatNumber(queueMetrics.returns.pendingStockIn) : "Restricted",
      to: canViewOps ? buildDashboardLink("/returns", { returnOrderStatuses: "OPEN,PARTIAL_RECEIVED" }, "return-orders") : undefined,
    },
  ];

  const workOrderMetrics = [
    {
      label: "Pending Review",
      value: canViewOps ? formatNumber(queueMetrics.workOrder.pendingReview) : "Restricted",
      to: canViewOps ? buildDashboardLink("/counting", { approvalStatus: "PENDING" }, "variance-approvals") : undefined,
    },
  ];

  const financeMetrics = [
    {
      label: "Deduction pending review",
      value: canViewFinance ? formatNumber(queueMetrics.finance.deductionPendingReview) : "Restricted",
      to: canViewFinance ? buildDashboardLink("/finance", {}, "recharge-review") : undefined,
    },
    {
      label: "Recharge pending review",
      value: canViewFinance ? formatNumber(queueMetrics.finance.rechargePendingReview) : "Restricted",
      to: canViewFinance ? buildDashboardLink("/finance", {}, "recharge-review") : undefined,
    },
    {
      label: "Quota pending review",
      value: canViewFinance ? formatNumber(queueMetrics.finance.quotaPendingReview) : "Restricted",
      to: canViewFinance ? buildDashboardLink("/finance", {}, "voucher-management") : undefined,
    },
  ];

  return (
    <Stack spacing={3}>
      <PageHeader
        actions={
          <Stack alignItems={{ sm: "center" }} direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField
              disabled={warehouses.length === 0}
              label="Warehouse"
              onChange={(event) => setActiveWarehouseId(Number(event.target.value))}
              select
              size="small"
              sx={{ minWidth: 220 }}
              value={activeWarehouseId ? String(activeWarehouseId) : ""}
            >
              {warehouses.map((warehouse) => (
                <MenuItem key={warehouse.id} value={String(warehouse.id)}>
                  {warehouse.warehouse_name}
                </MenuItem>
              ))}
            </TextField>
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
        description={`Operator workbench for ${company?.label ?? "the current tenant"}. Warehouse selection controls the queue cards and summary tiles below.`}
        title="Operations workbench"
      />

      {visibleWidgets.has("metrics") ? (
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
            <MetricCard
              helper={activeWarehouse ? `${activeWarehouse.warehouse_city} | ${activeWarehouse.warehouse_manager}` : "No warehouse configured yet."}
              label="Active warehouse"
              value={warehouseLabel}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
            <MetricCard
              helper={canViewOps ? `${formatNumber(visibleOnHand)} visible units in the current warehouse.` : "Requires an operations role."}
              label="Visible on-hand"
              value={canViewOps ? formatNumber(visibleOnHand) : "Restricted"}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
            <MetricCard
              helper="Open supervisor approvals for count variances."
              label="Pending approvals"
              value={canViewOps ? approvalsSummaryQuery.data?.pending_count ?? "--" : "Restricted"}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
            <MetricCard
              helper={canViewFinance ? `${invoicesQuery.data?.count ?? 0} invoices in finance scope.` : "Requires finance visibility."}
              label="Finance invoices"
              value={canViewFinance ? invoicesQuery.data?.count ?? "--" : "Restricted"}
            />
          </Grid>
        </Grid>
      ) : null}

      {visibleWidgets.has("ops-summary") ? (
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, md: 6, xl: 2 }}>
            <DashboardQueueCard metrics={stockInMetrics} subtitle={warehouseLabel} title="Stock In" />
          </Grid>
          <Grid size={{ xs: 12, md: 6, xl: 2 }}>
            <DashboardQueueCard metrics={outboundMetrics} subtitle={warehouseLabel} title="Dropshipping Stock-Out" />
          </Grid>
          <Grid size={{ xs: 12, md: 6, xl: 2 }}>
            <DashboardQueueCard metrics={dispatchMetrics} subtitle={warehouseLabel} title="Dispatch / Handover" />
          </Grid>
          <Grid size={{ xs: 12, md: 6, xl: 2 }}>
            <DashboardQueueCard metrics={returnMetrics} subtitle={warehouseLabel} title="Return" />
          </Grid>
          <Grid size={{ xs: 12, md: 6, xl: 2 }}>
            <DashboardQueueCard metrics={workOrderMetrics} subtitle={warehouseLabel} title="Work Order" />
          </Grid>
          <Grid size={{ xs: 12, md: 6, xl: 2 }}>
            <DashboardQueueCard metrics={financeMetrics} subtitle={warehouseLabel} title="Finance" />
          </Grid>
        </Grid>
      ) : null}

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, xl: 8 }}>
          <Stack spacing={2.5}>
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
                    <ListItemText primary="Warehouse" secondary={warehouseLabel} />
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
