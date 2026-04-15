import { useState } from "react";

import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import AssignmentReturnOutlinedIcon from "@mui/icons-material/AssignmentReturnOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import LoginRoundedIcon from "@mui/icons-material/LoginRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import Grid from "@mui/material/Grid";
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  FormGroup,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import { brandShadows } from "@/app/brand";
import { useI18n } from "@/app/ui-preferences";
import { useDashboardController } from "@/features/dashboard/controller/useDashboardController";
import { DashboardOrderStatisticsCard } from "@/features/dashboard/view/components/DashboardOrderStatisticsCard";
import { DashboardQueueCard } from "@/features/dashboard/view/components/DashboardQueueCard";
import type { DashboardQueueMetric, DashboardQueueSection } from "@/features/dashboard/view/components/DashboardQueueCard";
import { formatNumber } from "@/shared/utils/format";

const DEFAULT_VISIBLE_WIDGET_KEYS = ["ops-summary", "order-trends"] as const;

type DashboardPanelKey = (typeof DEFAULT_VISIBLE_WIDGET_KEYS)[number];
type DashboardQueueSectionKey = "stock-in" | "outbound" | "dispatch" | "return" | "work-order" | "finance";

interface DashboardLayoutPayload {
  hidden_queue_metric_keys: string[];
  hidden_queue_section_keys: DashboardQueueSectionKey[];
}

interface DashboardCustomizationDraft {
  hiddenQueueMetricKeys: string[];
  hiddenQueueSectionKeys: DashboardQueueSectionKey[];
  visibleWidgetKeys: string[];
}

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

function toStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function toggleArrayItem<T extends string>(items: T[], value: T) {
  return items.includes(value) ? items.filter((item) => item !== value) : [...items, value];
}

function buildDashboardLayoutPayload(layoutPayload: Record<string, unknown> | undefined): DashboardLayoutPayload {
  return {
    hidden_queue_metric_keys: toStringArray(layoutPayload?.hidden_queue_metric_keys),
    hidden_queue_section_keys: toStringArray(layoutPayload?.hidden_queue_section_keys) as DashboardQueueSectionKey[],
  };
}

function isQueueSectionKey(value: string): value is DashboardQueueSectionKey {
  return ["stock-in", "outbound", "dispatch", "return", "work-order", "finance"].includes(value);
}

export function DashboardPage() {
  const theme = useTheme();
  const { t, translate, msg } = useI18n();
  const isDark = theme.palette.mode === "dark";
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [customizationDraft, setCustomizationDraft] = useState<DashboardCustomizationDraft>({
    hiddenQueueMetricKeys: [],
    hiddenQueueSectionKeys: [],
    visibleWidgetKeys: [...DEFAULT_VISIBLE_WIDGET_KEYS],
  });
  const {
    activeWarehouseId,
    canViewFinance,
    canViewOps,
    customDateFrom,
    customDateTo,
    orderStatisticsQuery,
    queueMetrics,
    revenueOverview,
    setActiveWarehouseId,
    timeWindow,
    updateWorkbenchPreference,
    visibleWidgetKeys,
    warehouses,
    workbenchPreferenceQuery,
  } = useDashboardController();

  const hasSavedWorkbenchPreference = Boolean(workbenchPreferenceQuery.data);
  const effectiveVisibleWidgetKeys = hasSavedWorkbenchPreference
    ? visibleWidgetKeys
    : [...DEFAULT_VISIBLE_WIDGET_KEYS];
  const rawLayoutPayload =
    workbenchPreferenceQuery.data?.layout_payload && typeof workbenchPreferenceQuery.data.layout_payload === "object"
      ? workbenchPreferenceQuery.data.layout_payload
      : {};
  const layoutPayload = buildDashboardLayoutPayload(rawLayoutPayload);
  const visibleWidgets = new Set(effectiveVisibleWidgetKeys);
  const hiddenQueueMetricSet = new Set(layoutPayload.hidden_queue_metric_keys);
  const hiddenQueueSectionSet = new Set(layoutPayload.hidden_queue_section_keys);

  const stockInMetrics: DashboardQueueMetric[] = [
    {
      key: "stock-in-pending",
      label: "Pending Stock In",
      tone: "warning",
      value: canViewOps ? formatNumber(queueMetrics.stockIn.pendingStockIn) : "Restricted",
      to: canViewOps ? buildDashboardLink("/inbound", { poStatuses: "OPEN,PARTIAL" }, "purchase-orders") : undefined,
    },
    {
      key: "stock-in-transit",
      label: "In Transit",
      tone: "info",
      value: canViewOps ? formatNumber(queueMetrics.stockIn.inTransit) : "Restricted",
      to: canViewOps ? buildDashboardLink("/inbound", { asnStatuses: "OPEN,PARTIAL" }, "advance-shipment-notices") : undefined,
    },
    {
      key: "stock-in-stocking",
      label: "Stocking In",
      tone: "success",
      value: canViewOps ? formatNumber(queueMetrics.stockIn.stockingIn) : "Restricted",
      to: canViewOps ? buildDashboardLink("/inbound", { putawayStatuses: "OPEN,ASSIGNED" }, "putaway-tasks") : undefined,
    },
  ];

  const outboundMetrics: DashboardQueueMetric[] = [
    {
      key: "outbound-generate",
      label: "To Generate / In Process",
      tone: "warning",
      value: canViewOps ? formatNumber(queueMetrics.outbound.toGenerateInProcess) : "Restricted",
      to: canViewOps ? buildDashboardLink("/outbound", { salesOrderStage: "IN_PROCESS" }, "package-management") : undefined,
    },
    {
      key: "outbound-move",
      label: "To Move",
      tone: "warning",
      value: canViewOps ? formatNumber(queueMetrics.outbound.toMove) : "Restricted",
      to: canViewOps ? buildDashboardLink("/outbound", { salesOrderStage: "TO_MOVE" }, "package-management") : undefined,
    },
    {
      key: "outbound-abnormal",
      label: "Abnormal",
      tone: "danger",
      value: canViewOps ? formatNumber(queueMetrics.outbound.abnormal) : "Restricted",
      to: canViewOps ? buildDashboardLink("/outbound", { salesOrderException: "ABNORMAL_PACKAGE" }, "abnormal-package") : undefined,
    },
    {
      key: "outbound-pick",
      label: "To Pick",
      tone: "warning",
      value: canViewOps ? formatNumber(queueMetrics.outbound.toPick) : "Restricted",
      to: canViewOps ? buildDashboardLink("/outbound", { pickTaskStatuses: "OPEN,ASSIGNED" }, "secondary-picking") : undefined,
    },
    {
      key: "outbound-print",
      label: "To Print & Stock-Out",
      tone: "warning",
      value: canViewOps ? formatNumber(queueMetrics.outbound.toPrintAndStockOut) : "Restricted",
      to: canViewOps ? buildDashboardLink("/outbound", { salesOrderStage: "TO_SHIP", waybillPrinted: "false" }, "package-management") : undefined,
    },
    {
      key: "outbound-interception",
      label: "Order interception",
      tone: "danger",
      value: canViewOps ? formatNumber(queueMetrics.outbound.orderInterception) : "Restricted",
      to: canViewOps ? buildDashboardLink("/outbound", { salesOrderException: "ORDER_INTERCEPTION" }, "interception-manage") : undefined,
    },
    {
      key: "outbound-ship",
      label: "To Ship",
      tone: "info",
      value: canViewOps ? formatNumber(queueMetrics.outbound.toShip) : "Restricted",
      to: canViewOps ? buildDashboardLink("/outbound", { salesOrderStage: "TO_SHIP", waybillPrinted: "true" }, "package-management") : undefined,
    },
    {
      key: "outbound-tracking",
      label: "Get Tracking No",
      tone: "info",
      value: canViewOps ? formatNumber(queueMetrics.outbound.getTrackingNo) : "Restricted",
      to: canViewOps ? buildDashboardLink("/outbound", { salesOrderStage: "GET_TRACKING_NO" }, "package-management") : undefined,
    },
  ];

  const dispatchMetrics: DashboardQueueMetric[] = [
    {
      key: "dispatch-shipped",
      label: "Shipped",
      tone: "success",
      value: canViewOps ? formatNumber(queueMetrics.dispatch.shipped) : "Restricted",
      to: canViewOps ? buildDashboardLink("/outbound", { shipmentStatus: "POSTED" }, "shipping-manage") : undefined,
    },
    {
      key: "dispatch-not-shipped",
      label: "Not Shipped",
      tone: "warning",
      value: canViewOps ? formatNumber(queueMetrics.dispatch.notShipped) : "Restricted",
      to: canViewOps ? buildDashboardLink("/outbound", { salesOrderStatuses: "OPEN,ALLOCATED,PICKING,PICKED" }, "package-management") : undefined,
    },
    {
      key: "dispatch-cancelled",
      label: "Order Cancellation",
      tone: "danger",
      value: canViewOps ? formatNumber(queueMetrics.dispatch.orderCancellation) : "Restricted",
      to: canViewOps ? buildDashboardLink("/outbound", { salesOrderStatus: "CANCELLED" }, "package-management") : undefined,
    },
  ];

  const returnMetrics: DashboardQueueMetric[] = [
    {
      key: "return-pending-stock-in",
      label: "Pending Stock In",
      tone: "warning",
      value: canViewOps ? formatNumber(queueMetrics.returns.pendingStockIn) : "Restricted",
      to: canViewOps ? buildDashboardLink("/returns", { returnOrderStatuses: "OPEN,PARTIAL_RECEIVED" }, "return-orders") : undefined,
    },
  ];

  const workOrderMetrics: DashboardQueueMetric[] = [
    {
      key: "work-order-pending-review",
      label: "Pending Review",
      tone: "warning",
      value: canViewOps ? formatNumber(queueMetrics.workOrder.pendingReview) : "Restricted",
      to: canViewOps ? buildDashboardLink("/counting", { approvalStatus: "PENDING" }, "variance-approvals") : undefined,
    },
  ];

  const financeMetrics: DashboardQueueMetric[] = [
    {
      key: "finance-recharge-review",
      label: "Recharge pending review",
      tone: "info",
      value: canViewFinance ? formatNumber(queueMetrics.finance.rechargePendingReview) : "Restricted",
      to: canViewFinance ? buildDashboardLink("/finance", {}, "recharge-review") : undefined,
    },
    {
      key: "finance-deduction-review",
      label: "Deduction pending review",
      tone: "warning",
      value: canViewFinance ? formatNumber(queueMetrics.finance.deductionPendingReview) : "Restricted",
      to: canViewFinance ? buildDashboardLink("/finance", {}, "recharge-review") : undefined,
    },
    {
      key: "finance-quota-review",
      label: "Quota pending review",
      tone: "warning",
      value: canViewFinance ? formatNumber(queueMetrics.finance.quotaPendingReview) : "Restricted",
      to: canViewFinance ? buildDashboardLink("/finance", {}, "voucher-management") : undefined,
    },
  ];

  const queueSections: DashboardQueueSection[] = [
    {
      key: "stock-in",
      columns: 1,
      icon: <LoginRoundedIcon fontSize="small" />,
      iconTone: "success",
      metrics: stockInMetrics,
      title: "Stock In",
    },
    {
      key: "outbound",
      columns: 3,
      icon: <Inventory2OutlinedIcon fontSize="small" />,
      iconTone: "info",
      metrics: outboundMetrics,
      title: "Dropshipping Stock-Out",
    },
    {
      key: "dispatch",
      columns: 1,
      icon: <LocalShippingOutlinedIcon fontSize="small" />,
      iconTone: "success",
      metrics: dispatchMetrics,
      title: "Dispatch / Handover",
    },
    {
      key: "return",
      columns: 1,
      icon: <AssignmentReturnOutlinedIcon fontSize="small" />,
      iconTone: "danger",
      metrics: returnMetrics,
      title: "Return",
    },
    {
      key: "work-order",
      columns: 1,
      icon: <FactCheckOutlinedIcon fontSize="small" />,
      iconTone: "info",
      metrics: workOrderMetrics,
      title: "Work Order",
    },
    {
      key: "finance",
      columns: 1,
      icon: <AccountBalanceWalletOutlinedIcon fontSize="small" />,
      iconTone: "warning",
      metrics: financeMetrics,
      title: "Finance",
    },
  ];

  const panelOptions: { key: DashboardPanelKey; label: string }[] = [
    { key: "ops-summary", label: "Operational queues" },
    { key: "order-trends", label: "Order statistics" },
  ];
  const queueMetricsBySection = new Map(
    queueSections.map((section) => [section.key as DashboardQueueSectionKey, section.metrics.map((metric) => metric.key)]),
  );

  function buildVisibleQueueSection(section: DashboardQueueSection) {
    if (hiddenQueueSectionSet.has(section.key as DashboardQueueSectionKey)) {
      return null;
    }

    const metrics = section.metrics.filter((metric) => !hiddenQueueMetricSet.has(metric.key));
    if (metrics.length === 0) {
      return null;
    }

    return {
      ...section,
      metrics,
    };
  }

  function buildCustomizationDraft() {
    return {
      hiddenQueueMetricKeys: [...layoutPayload.hidden_queue_metric_keys],
      hiddenQueueSectionKeys: [...layoutPayload.hidden_queue_section_keys],
      visibleWidgetKeys: [...effectiveVisibleWidgetKeys],
    };
  }

  function toggleQueueSectionInDraft(sectionKey: DashboardQueueSectionKey) {
    setCustomizationDraft((current) => {
      const isHidden = current.hiddenQueueSectionKeys.includes(sectionKey);
      const nextHiddenQueueSectionKeys = isHidden
        ? current.hiddenQueueSectionKeys.filter((item) => item !== sectionKey)
        : [...current.hiddenQueueSectionKeys, sectionKey];
      const sectionMetricKeys = queueMetricsBySection.get(sectionKey) ?? [];

      return {
        ...current,
        hiddenQueueMetricKeys: isHidden
          ? current.hiddenQueueMetricKeys
          : current.hiddenQueueMetricKeys.filter((metricKey) => !sectionMetricKeys.includes(metricKey)),
        hiddenQueueSectionKeys: nextHiddenQueueSectionKeys,
      };
    });
  }

  function togglePanelInDraft(panelKey: DashboardPanelKey) {
    setCustomizationDraft((current) => {
      const nextVisibleWidgetKeys = toggleArrayItem(current.visibleWidgetKeys, panelKey);
      return {
        ...current,
        hiddenQueueMetricKeys: panelKey === "ops-summary" && !nextVisibleWidgetKeys.includes("ops-summary")
          ? []
          : current.hiddenQueueMetricKeys,
        hiddenQueueSectionKeys: panelKey === "ops-summary" && !nextVisibleWidgetKeys.includes("ops-summary")
          ? []
          : current.hiddenQueueSectionKeys,
        visibleWidgetKeys: nextVisibleWidgetKeys,
      };
    });
  }

  const visibleStockInSection = buildVisibleQueueSection(queueSections[0]);
  const visibleOutboundSection = buildVisibleQueueSection(queueSections[1]);
  const visibleDispatchSection = buildVisibleQueueSection(queueSections[2]);
  const visibleReturnAndWorkOrderSections = [queueSections[3], queueSections[4]]
    .map(buildVisibleQueueSection)
    .filter((section): section is DashboardQueueSection => Boolean(section));
  const visibleFinanceSection = buildVisibleQueueSection(queueSections[5]);
  const isQueuesPanelEnabledInDraft = customizationDraft.visibleWidgetKeys.includes("ops-summary");

  return (
    <Stack spacing={2}>
      <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={1.5}>
        <FormControl
          size="small"
          sx={{
            minWidth: 220,
            "& .MuiOutlinedInput-root": {
              backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.92 : 0.98),
              borderRadius: 999,
              boxShadow: isDark ? brandShadows.floatingDark : brandShadows.floatingLight,
            },
          }}
        >
          <Select
            aria-label="Warehouse"
            disabled={warehouses.length === 0}
            onChange={(event) => setActiveWarehouseId(Number(event.target.value))}
            SelectDisplayProps={{ "aria-label": "Warehouse" }}
            value={activeWarehouseId ? String(activeWarehouseId) : ""}
          >
            {warehouses.map((warehouse) => (
              <MenuItem key={warehouse.id} value={String(warehouse.id)}>
                {warehouse.warehouse_name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Tooltip title="Customize dashboard">
          <IconButton
            aria-label="Customize dashboard"
            onClick={() => {
              setCustomizationDraft(buildCustomizationDraft());
              setIsCustomizeOpen(true);
            }}
            sx={{
              backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.92 : 0.98),
              border: `1px solid ${alpha(theme.palette.divider, 0.85)}`,
              borderRadius: 999,
              boxShadow: isDark ? brandShadows.floatingDark : brandShadows.floatingLight,
              color: theme.palette.text.primary,
            }}
          >
            <TuneRoundedIcon />
          </IconButton>
        </Tooltip>
      </Stack>

      {visibleWidgets.has("ops-summary") ? (
        <Box sx={{ overflowX: "auto", pb: 0.5 }}>
          <Box
            sx={{
              display: "grid",
              gap: 1.5,
              gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
              minWidth: {
                xs: 1100,
                lg: 1180,
              },
            }}
          >
            {visibleStockInSection ? (
              <Box sx={{ minWidth: 0 }}>
                <DashboardQueueCard sections={[visibleStockInSection]} />
              </Box>
            ) : null}

            {visibleOutboundSection ? (
              <Box sx={{ gridColumn: "span 3", minWidth: 0 }}>
                <DashboardQueueCard sections={[visibleOutboundSection]} />
              </Box>
            ) : null}

            {visibleDispatchSection ? (
              <Box sx={{ minWidth: 0 }}>
                <DashboardQueueCard sections={[visibleDispatchSection]} />
              </Box>
            ) : null}

            {visibleReturnAndWorkOrderSections.length > 0 ? (
              <Box sx={{ minWidth: 0 }}>
                <DashboardQueueCard sections={visibleReturnAndWorkOrderSections} />
              </Box>
            ) : null}

            {visibleFinanceSection ? (
              <Box sx={{ minWidth: 0 }}>
                <DashboardQueueCard sections={[visibleFinanceSection]} />
              </Box>
            ) : null}
          </Box>
        </Box>
      ) : null}

      {visibleWidgets.has("order-trends") ? (
        <DashboardOrderStatisticsCard
          customDateFrom={customDateFrom}
          customDateTo={customDateTo}
          data={orderStatisticsQuery.data}
          isLoading={orderStatisticsQuery.isLoading}
          isRevenueLoading={revenueOverview?.isLoading ?? false}
          isRevenueRestricted={!canViewFinance}
          isRestricted={!canViewOps}
          isSavingPreference={updateWorkbenchPreference.isPending}
          onDateRangeApply={(dateFrom, dateTo) => {
            updateWorkbenchPreference.mutate({
              custom_date_from: dateFrom,
              custom_date_to: dateTo,
              time_window: "CUSTOM",
            });
          }}
          onTimeWindowChange={(nextTimeWindow) => {
            if (nextTimeWindow !== timeWindow) {
              updateWorkbenchPreference.mutate({ time_window: nextTimeWindow });
            }
          }}
          revenueOverview={revenueOverview}
          timeWindow={timeWindow}
        />
      ) : null}

      <Dialog fullWidth maxWidth="md" onClose={() => setIsCustomizeOpen(false)} open={isCustomizeOpen}>
        <DialogTitle>{t("Customize dashboard")}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3}>
            <Stack spacing={1.5}>
              <Typography sx={{ fontWeight: 700 }} variant="subtitle2">
                {t("Panels")}
              </Typography>
              <FormGroup>
                {panelOptions.map((option) => {
                  const checked = customizationDraft.visibleWidgetKeys.includes(option.key);

                  return (
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={checked}
                          onChange={() => {
                            togglePanelInDraft(option.key);
                          }}
                        />
                      }
                      key={option.key}
                      label={option.label}
                    />
                  );
                })}
              </FormGroup>
            </Stack>

            <Divider />

            <Stack spacing={1.5}>
              <Typography sx={{ fontWeight: 700 }} variant="subtitle2">
                {t("Operational queues")}
              </Typography>
              <Stack spacing={2}>
                {queueSections.map((section) => {
                  const sectionKey = isQueueSectionKey(section.key) ? section.key : null;
                  const sectionHidden = sectionKey ? customizationDraft.hiddenQueueSectionKeys.includes(sectionKey) : false;

                  return (
                    <Box
                      key={`${section.key}-metrics`}
                      sx={{
                        border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                        borderRadius: 2.5,
                        opacity: isQueuesPanelEnabledInDraft ? 1 : 0.48,
                        px: 1.5,
                        py: 1.25,
                      }}
                    >
                      <Stack spacing={1}>
                        <Stack
                          alignItems="center"
                          direction={{ xs: "column", sm: "row" }}
                          justifyContent="space-between"
                          spacing={1}
                        >
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={!sectionHidden}
                                disabled={!isQueuesPanelEnabledInDraft}
                                onChange={() => {
                                  if (sectionKey) {
                                    toggleQueueSectionInDraft(sectionKey);
                                  }
                                }}
                              />
                            }
                            label={section.title}
                            sx={{ mr: 0 }}
                          />
                          <Chip
                            label={t("dashboard.cellsCount", { count: section.metrics.length })}
                            size="small"
                            variant={sectionHidden ? "outlined" : "filled"}
                          />
                        </Stack>
                        <FormGroup
                          row
                          sx={{
                            columnGap: 1.5,
                            opacity: sectionHidden ? 0.48 : 1,
                            pl: { sm: 4.5 },
                            rowGap: 0.25,
                          }}
                        >
                          {section.metrics.map((metric) => (
                            <FormControlLabel
                              control={
                                <Checkbox
                                  checked={!customizationDraft.hiddenQueueMetricKeys.includes(metric.key)}
                                  disabled={!isQueuesPanelEnabledInDraft || sectionHidden}
                                  onChange={() => {
                                    setCustomizationDraft((current) => ({
                                      ...current,
                                      hiddenQueueMetricKeys: toggleArrayItem(current.hiddenQueueMetricKeys, metric.key),
                                    }));
                                  }}
                                />
                              }
                              key={metric.key}
                              label={t("dashboard.metricLinkLabel", {
                                label: translate(metric.label),
                                section: translate(section.title),
                              })}
                              sx={{
                                flex: {
                                  xs: "1 1 100%",
                                  md: "1 1 calc(50% - 12px)",
                                },
                                m: 0,
                                minWidth: 0,
                              }}
                            />
                          ))}
                        </FormGroup>
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsCustomizeOpen(false)} variant="text">
            Cancel
          </Button>
          <Button
            onClick={() => {
              const hiddenQueueSectionKeys = isQueuesPanelEnabledInDraft ? customizationDraft.hiddenQueueSectionKeys : [];
              const hiddenSections = new Set(hiddenQueueSectionKeys);
              const hiddenMetricKeys = (isQueuesPanelEnabledInDraft ? customizationDraft.hiddenQueueMetricKeys : []).filter((metricKey) => {
                const section = queueSections.find((candidate) => candidate.metrics.some((metric) => metric.key === metricKey));
                return section ? !hiddenSections.has(section.key as DashboardQueueSectionKey) : true;
              });

              updateWorkbenchPreference.mutate({
                layout_payload: {
                  ...rawLayoutPayload,
                  hidden_queue_metric_keys: hiddenMetricKeys,
                  hidden_queue_section_keys: hiddenQueueSectionKeys,
                },
                right_rail_widget_keys: [],
                visible_widget_keys: customizationDraft.visibleWidgetKeys,
              });
              setIsCustomizeOpen(false);
            }}
            variant="contained"
          >
            Apply
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
