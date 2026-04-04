import { useEffect, useState } from "react";

import IosShareOutlinedIcon from "@mui/icons-material/IosShareOutlined";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import { Box, Button, Card, CardContent, Skeleton, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import type {
  DashboardOrderStatistics,
  DashboardOrderStatisticsBucket,
  DashboardTimeWindow,
} from "@/features/dashboard/model/types";
import type { DashboardRevenueOverviewSourceData } from "@/features/dashboard/view/components/DashboardRevenueOverviewCard";
import { DashboardRevenueOverviewCard } from "@/features/dashboard/view/components/DashboardRevenueOverviewCard";
import { RangePicker } from "@/shared/components/range-picker";
import { formatNumber } from "@/shared/utils/format";

interface DashboardOrderStatisticsCardProps {
  customDateFrom: string | null;
  customDateTo: string | null;
  data?: DashboardOrderStatistics;
  isLoading: boolean;
  isRevenueLoading?: boolean;
  isRevenueRestricted?: boolean;
  isRestricted?: boolean;
  isSavingPreference?: boolean;
  onDateRangeApply: (dateFrom: string, dateTo: string) => void;
  onTimeWindowChange: (nextTimeWindow: Exclude<DashboardTimeWindow, "CUSTOM">) => void;
  revenueOverview?: DashboardRevenueOverviewSourceData;
  timeWindow: DashboardTimeWindow;
}

type SeriesKey = "dropshipping_orders" | "stock_in_quantity";
type ChartPoint = { x: number; y: number };

const WINDOW_OPTIONS: { label: string; value: Exclude<DashboardTimeWindow, "CUSTOM"> }[] = [
  { label: "This Week", value: "WEEK" },
  { label: "This Month", value: "MONTH" },
  { label: "This Year", value: "YEAR" },
];

const STORAGE_BREAKDOWN = [
  { color: "#1C63E5", label: "Product Inventory", value: 0 },
  { color: "#22A7A5", label: "B2B Inventory", value: 0 },
  { color: "#97D816", label: "FBA Return Stock", value: 0 },
] as const;

function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function hasTimeComponent(value: string) {
  return value.includes("T");
}

function parseLocalTemporal(value: string) {
  if (!value) {
    return new Date(Number.NaN);
  }

  if (!hasTimeComponent(value)) {
    return parseLocalDate(value);
  }

  return new Date(value.length === 16 ? `${value}:00` : value);
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function formatHourInputValue(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:00`;
}

function isCompleteHourInput(value: string) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value);
}

function toHourDraftValue(value: string | null | undefined, boundary: "start" | "end") {
  if (!value) {
    return "";
  }

  if (hasTimeComponent(value)) {
    return value.slice(0, 16);
  }

  return `${value}T${boundary === "start" ? "00:00" : "23:00"}`;
}

function buildPresetHourRange(timeWindow: Exclude<DashboardTimeWindow, "CUSTOM">) {
  const end = new Date();
  end.setMinutes(0, 0, 0);

  const start = new Date(end);
  if (timeWindow === "YEAR") {
    start.setMonth(0, 1);
  } else if (timeWindow === "MONTH") {
    start.setDate(1);
  } else {
    const day = start.getDay();
    const weekdayOffset = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - weekdayOffset);
  }
  start.setHours(0, 0, 0, 0);

  return {
    dateFrom: formatHourInputValue(start),
    dateTo: formatHourInputValue(end),
  };
}

function formatBucketLabel(value: string, bucketCount: number) {
  const date = parseLocalTemporal(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  if (hasTimeComponent(value)) {
    if (bucketCount > 36) {
      return `${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:00`;
    }

    return `${pad2(date.getHours())}:00`;
  }

  if (bucketCount > 90) {
    return date.toLocaleDateString(undefined, { month: "short" });
  }

  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function buildNiceMax(value: number) {
  if (value <= 0) {
    return 0;
  }

  return Math.max(1, Math.round(value * 1.1));
}

function buildSeriesPoints(
  buckets: DashboardOrderStatisticsBucket[],
  key: SeriesKey,
  width: number,
  height: number,
  maxValue: number,
): ChartPoint[] {
  if (buckets.length === 0) {
    return [];
  }

  const safeWidth = Math.max(width, 1);
  const safeHeight = Math.max(height, 1);
  const safeMaxValue = maxValue > 0 ? maxValue : 1;
  const xStep = buckets.length > 1 ? safeWidth / (buckets.length - 1) : 0;

  return buckets.map((bucket, index) => {
    const rawValue = key === "dropshipping_orders" ? bucket.dropshipping_orders : bucket.stock_in_quantity;
    const x = buckets.length > 1 ? index * xStep : safeWidth / 2;
    const y = safeHeight - (rawValue / safeMaxValue) * safeHeight;

    return { x, y };
  });
}

function buildCurvedSeriesPath(points: ChartPoint[]) {
  if (points.length === 0) {
    return "";
  }

  if (points.length === 1) {
    const point = points[0];
    return `M ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }

  return points.reduce((path, point, index, collection) => {
    if (index === 0) {
      return `M ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    }

    const previous = collection[index - 1];
    const previousPrevious = collection[index - 2] ?? previous;
    const next = collection[index + 1] ?? point;
    const cp1x = previous.x + (point.x - previousPrevious.x) / 6;
    const cp1y = previous.y + (point.y - previousPrevious.y) / 6;
    const cp2x = point.x - (next.x - previous.x) / 6;
    const cp2y = point.y - (next.y - previous.y) / 6;

    return `${path} C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }, "");
}

function downloadStatisticsCsv(data?: DashboardOrderStatistics) {
  if (!data || typeof document === "undefined" || typeof URL.createObjectURL !== "function") {
    return;
  }

  const csvContent = [
    ["date", "dropshipping_orders", "stock_in_quantity"].join(","),
    ...data.buckets.map((bucket) => [bucket.date, String(bucket.dropshipping_orders), String(bucket.stock_in_quantity)].join(",")),
  ].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `order-qty-statistics-${data.date_from}-to-${data.date_to}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function SummaryCard({
  accentColor,
  label,
  value,
}: {
  accentColor: string;
  label: string;
  value: string;
}) {
  return (
    <Box
      sx={{
        background: (theme) =>
          `linear-gradient(180deg, ${alpha(accentColor, 0.08)} 0%, ${alpha(theme.palette.background.paper, 0.98)} 58%)`,
        border: (theme) => `1px solid ${alpha(accentColor, 0.2)}`,
        borderRadius: "12px",
        boxShadow: `inset 0 1px 0 ${alpha("#FFFFFF", 0.04)}`,
        flex: "1 1 300px",
        maxWidth: { md: 360 },
        minHeight: 64,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <Box
        sx={{
          bgcolor: accentColor,
          borderRadius: "12px 0 0 12px",
          bottom: 0,
          left: 0,
          position: "absolute",
          top: 0,
          width: 5,
        }}
      />
      <Stack justifyContent="space-between" spacing={1} sx={{ height: "100%", p: 1.5, pl: 2.25 }}>
        <Typography
          sx={{
            color: "text.primary",
            fontSize: "10px",
            fontWeight: 700,
            lineHeight: 1.25,
          }}
        >
          {label}
        </Typography>
        <Typography
          sx={{
            color: "text.primary",
            fontSize: "28px",
            fontWeight: 800,
            letterSpacing: "-0.04em",
            lineHeight: 1,
          }}
        >
          {value}
        </Typography>
      </Stack>
    </Box>
  );
}

function StorageCapacityCard() {
  return (
    <Card
      sx={{
        background: (theme) =>
          `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.98)} 0%, ${alpha(theme.palette.background.default, 0.88)} 100%)`,
        border: (theme) => `1px solid ${alpha(theme.palette.divider, 0.92)}`,
        borderRadius: "14px",
        boxShadow: "none",
        minWidth: { xs: "100%", lg: 288 },
      }}
    >
      <CardContent sx={{ p: 1.75, "&:last-child": { pb: 1.75 } }}>
        <Stack spacing={1.5}>
          <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={1.5}>
            <Typography
              sx={{
                fontSize: "12px",
                fontWeight: 800,
                letterSpacing: "-0.03em",
              }}
            >
              Storage Capacity
            </Typography>
            <Button
              endIcon={<KeyboardArrowDownRoundedIcon />}
              sx={{
                "& .MuiButton-endIcon": {
                  color: "text.secondary",
                  ml: 1,
                },
                borderRadius: "10px",
                fontSize: "11px",
                fontWeight: 700,
                minHeight: 40,
                minWidth: 124,
                px: 1.5,
              }}
              type="button"
              variant="outlined"
            >
              SKU Qty
            </Button>
          </Stack>

          <Box
            sx={{
              backgroundColor: (theme) => alpha(theme.palette.background.paper, 0.96),
              border: (theme) => `1px solid ${alpha(theme.palette.divider, 0.32)}`,
              borderRadius: "12px",
              minHeight: 220,
              p: 1.5,
            }}
          >
            <Stack spacing={1.5}>
              <Typography
                sx={{
                  fontSize: "11px",
                  fontWeight: 800,
                  letterSpacing: "-0.03em",
                }}
              >
                Total number in stock
              </Typography>
              <Typography
                sx={{
                  fontSize: "32px",
                  fontWeight: 800,
                  letterSpacing: "-0.04em",
                  lineHeight: 1,
                }}
              >
                0
              </Typography>

              <Stack
                direction="row"
                sx={{
                  borderRadius: 999,
                  height: 8,
                  overflow: "hidden",
                  width: "74%",
                }}
              >
                {STORAGE_BREAKDOWN.map((item) => (
                  <Box key={item.label} sx={{ backgroundColor: item.color, flex: 1 }} />
                ))}
              </Stack>

              <Stack spacing={1}>
                {STORAGE_BREAKDOWN.map((item) => (
                  <Stack
                    alignItems="center"
                    direction="row"
                    justifyContent="space-between"
                    key={item.label}
                    spacing={1.5}
                    sx={{
                      backgroundColor: alpha(item.color, 0.08),
                      borderRadius: 999,
                      px: 1,
                      py: 0.75,
                    }}
                  >
                    <Stack alignItems="center" direction="row" spacing={1.25}>
                      <Box
                        sx={{
                          backgroundColor: item.color,
                          borderRadius: 999,
                          height: 8,
                          width: 8,
                        }}
                      />
                      <Typography
                        color="text.secondary"
                        sx={{
                          fontSize: "10px",
                          fontWeight: 600,
                        }}
                      >
                        {item.label}
                      </Typography>
                    </Stack>
                    <Typography
                      color="text.secondary"
                      sx={{
                        fontSize: "10px",
                        fontWeight: 700,
                      }}
                    >
                      {formatNumber(item.value)}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Stack>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

export function DashboardOrderStatisticsCard({
  customDateFrom,
  customDateTo,
  data,
  isLoading,
  isRevenueLoading = false,
  isRevenueRestricted = false,
  isRestricted = false,
  isSavingPreference = false,
  onDateRangeApply,
  onTimeWindowChange,
  revenueOverview,
  timeWindow,
}: DashboardOrderStatisticsCardProps) {
  const theme = useTheme();
  const [draftDateFrom, setDraftDateFrom] = useState(toHourDraftValue(customDateFrom ?? data?.date_from, "start"));
  const [draftDateTo, setDraftDateTo] = useState(toHourDraftValue(customDateTo ?? data?.date_to, "end"));
  const [hasPendingCustomSync, setHasPendingCustomSync] = useState(false);
  const chartHeight = 280;
  const chartWidth = 920;
  const yAxisWidth = 56;
  const bottomAxisHeight = 34;
  const chartPaddingTop = 14;
  const innerWidth = chartWidth - yAxisWidth - 20;
  const innerHeight = chartHeight - bottomAxisHeight - chartPaddingTop;
  const buckets = data?.buckets ?? [];
  const maxSeriesValue = Math.max(
    0,
    ...buckets.map((bucket) => Math.max(bucket.dropshipping_orders, bucket.stock_in_quantity)),
  );
  const yMax = buildNiceMax(maxSeriesValue);
  const gridLineCount = 5;
  const xLabelStep = Math.max(1, Math.ceil(buckets.length / 4));
  const dropshippingPoints = buildSeriesPoints(buckets, "dropshipping_orders", innerWidth, innerHeight, yMax);
  const stockInPoints = buildSeriesPoints(buckets, "stock_in_quantity", innerWidth, innerHeight, yMax);
  const dropshippingPath = buildCurvedSeriesPath(dropshippingPoints);
  const stockInPath = buildCurvedSeriesPath(stockInPoints);
  const hasBuckets = buckets.length > 0;
  const draftFromDate = parseLocalTemporal(draftDateFrom);
  const draftToDate = parseLocalTemporal(draftDateTo);
  const isInvalidCustomRange =
    Boolean(draftDateFrom && draftDateTo) &&
    !Number.isNaN(draftFromDate.getTime()) &&
    !Number.isNaN(draftToDate.getTime()) &&
    draftFromDate > draftToDate;
  const isCustomRangeUnchanged =
    timeWindow === "CUSTOM" &&
    draftDateFrom === toHourDraftValue(customDateFrom, "start") &&
    draftDateTo === toHourDraftValue(customDateTo, "end");
  const canApplyCustomRange = Boolean(draftDateFrom && draftDateTo) && !isInvalidCustomRange && !isCustomRangeUnchanged;
  const effectiveRange =
    data?.date_from && data?.date_to
      ? { dateFrom: data.date_from, dateTo: data.date_to }
      : timeWindow === "CUSTOM"
        ? { dateFrom: customDateFrom, dateTo: customDateTo }
        : buildPresetHourRange(timeWindow);

  useEffect(() => {
    setHasPendingCustomSync(false);

    if (timeWindow !== "CUSTOM") {
      const presetRange =
        data?.time_window === timeWindow && data?.date_from && data?.date_to
          ? {
              dateFrom: toHourDraftValue(data.date_from, "start"),
              dateTo: toHourDraftValue(data.date_to, "end"),
            }
          : buildPresetHourRange(timeWindow);
      setDraftDateFrom(presetRange.dateFrom);
      setDraftDateTo(presetRange.dateTo);
      return;
    }

    if (customDateFrom !== null || customDateTo !== null) {
      setDraftDateFrom(toHourDraftValue(customDateFrom, "start"));
      setDraftDateTo(toHourDraftValue(customDateTo, "end"));
      return;
    }

    setDraftDateFrom((current) => current || toHourDraftValue(data?.date_from, "start"));
    setDraftDateTo((current) => current || toHourDraftValue(data?.date_to, "end"));
  }, [customDateFrom, customDateTo, data?.date_from, data?.date_to, data?.time_window, timeWindow]);

  useEffect(() => {
    if (!hasPendingCustomSync || !canApplyCustomRange) {
      return;
    }

    if (!isCompleteHourInput(draftDateFrom) || !isCompleteHourInput(draftDateTo)) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      onDateRangeApply(draftDateFrom, draftDateTo);
      setHasPendingCustomSync(false);
    }, 450);

    return () => window.clearTimeout(timeoutId);
  }, [canApplyCustomRange, draftDateFrom, draftDateTo, hasPendingCustomSync, onDateRangeApply]);

  return (
    <Box
      sx={{
        display: "grid",
        gap: 2.25,
        gridTemplateColumns: {
          xs: "1fr",
          lg: !isRestricted ? "minmax(0, 1fr) minmax(0, 1fr) minmax(288px, 0.9fr)" : "1fr",
        },
      }}
    >
        <Card
        sx={{
          background: `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.99)} 0%, ${alpha(theme.palette.background.default, 0.9)} 100%)`,
          border: `1px solid ${alpha(theme.palette.divider, 0.92)}`,
          borderRadius: "14px",
          boxShadow: "none",
          gridColumn: { xs: "auto", lg: "span 2" },
          minWidth: 0,
        }}
      >
        <CardContent sx={{ p: { xs: 2, md: 2.5 }, "&:last-child": { pb: { xs: 2, md: 2.5 } } }}>
          <Stack spacing={3}>
            <Stack
              alignItems="center"
              direction="row"
              flexWrap="wrap"
              justifyContent="space-between"
              rowGap={1.25}
              spacing={1.5}
              useFlexGap
            >
              <Stack alignItems="baseline" direction="row" flexWrap="wrap" gap={1}>
              <Typography
                sx={{
                  fontSize: "14px",
                  fontWeight: 800,
                  letterSpacing: "-0.04em",
                  lineHeight: 1.1,
                }}
              >
                Order Qty statistics
              </Typography>
            </Stack>

            <Stack
              alignItems="center"
              direction="row"
              flexWrap="wrap"
              spacing={1}
              sx={{ justifyContent: "flex-end", ml: "auto", width: { xs: "100%", md: "auto" } }}
              useFlexGap
            >
              <Box
                sx={{
                  alignItems: "stretch",
                  bgcolor: alpha(theme.palette.background.default, 0.46),
                  border: `1px solid ${alpha(theme.palette.divider, 0.92)}`,
                  borderRadius: "12px",
                  display: "inline-flex",
                  gap: 0.5,
                  height: { md: 48 },
                  minHeight: 48,
                  p: 0.5,
                  width: { xs: "100%", sm: "auto" },
                }}
              >
                {WINDOW_OPTIONS.map((option) => {
                  const isActive = timeWindow === option.value;

                  return (
                    <Button
                      key={option.value}
                      disabled={isSavingPreference || isRestricted}
                      onClick={() => {
                        const presetRange = buildPresetHourRange(option.value);
                        setHasPendingCustomSync(false);
                        setDraftDateFrom(presetRange.dateFrom);
                        setDraftDateTo(presetRange.dateTo);
                        onTimeWindowChange(option.value);
                      }}
                      sx={{
                        "&:hover": {
                          backgroundColor: alpha(theme.palette.primary.main, isActive ? 0.18 : 0.08),
                        },
                        backgroundColor: isActive ? alpha(theme.palette.primary.main, 0.14) : "transparent",
                        borderRadius: "7px",
                        boxShadow: isActive ? `inset 0 0 0 1px ${alpha(theme.palette.primary.main, 0.6)}` : "none",
                        color: isActive ? theme.palette.primary.main : theme.palette.text.primary,
                        flex: 1,
                        fontSize: "10px",
                        fontWeight: isActive ? 800 : 700,
                        height: "100%",
                        lineHeight: 1.1,
                        minHeight: 38,
                        minWidth: { md: 92 },
                        px: { xs: 1.25, md: 1.5 },
                      }}
                      type="button"
                      variant="text"
                    >
                      {option.label}
                    </Button>
                  );
                })}
              </Box>

              <RangePicker
                active={timeWindow === "CUSTOM"}
                disabled={isRestricted}
                endAriaLabel="Range end"
                endValue={draftDateTo}
                error={isInvalidCustomRange}
                inputType="datetime-local"
                onEndChange={(value) => {
                  setDraftDateTo(value);
                  setHasPendingCustomSync(true);
                }}
                onStartChange={(value) => {
                  setDraftDateFrom(value);
                  setHasPendingCustomSync(true);
                }}
                startAriaLabel="Range start"
                startValue={draftDateFrom}
                step={3600}
              />

              <Button
                disabled={!data || isLoading || isRestricted}
                onClick={() => downloadStatisticsCsv(data)}
                startIcon={<IosShareOutlinedIcon />}
                sx={{
                  "&:hover": {
                    backgroundColor: alpha(theme.palette.background.paper, 1),
                    borderColor: alpha(theme.palette.divider, 0.96),
                  },
                  backgroundColor: alpha(theme.palette.background.paper, 0.98),
                  borderColor: alpha(theme.palette.divider, 0.92),
                  borderRadius: "10px",
                  color: theme.palette.text.primary,
                  fontSize: "10px",
                  fontWeight: 700,
                  height: { md: 48 },
                  minHeight: 48,
                  px: 2,
                }}
                type="button"
                variant="outlined"
              >
                Export
              </Button>
            </Stack>
            </Stack>

          <Stack direction={{ xs: "column", md: "row" }} flexWrap="wrap" spacing={1.5} useFlexGap>
            <SummaryCard
              accentColor={theme.palette.primary.main}
              label="Dropshipping"
              value={isRestricted ? "Restricted" : isLoading && !data ? "--" : formatNumber(data?.summary.dropshipping_orders ?? 0)}
            />
            <SummaryCard
              accentColor={theme.palette.success.main}
              label="Standard Stock-in"
              value={isRestricted ? "Restricted" : isLoading && !data ? "--" : formatNumber(data?.summary.stock_in_quantity ?? 0)}
            />
          </Stack>

          <Box
            sx={{
              background: `linear-gradient(180deg, ${alpha(theme.palette.background.default, 0.38)} 0%, ${alpha(theme.palette.background.paper, 0.94)} 100%)`,
              border: `1px solid ${alpha(theme.palette.divider, 0.72)}`,
              borderRadius: "12px",
              minHeight: chartHeight,
              minWidth: 0,
              overflow: "hidden",
              p: { xs: 1.25, md: 1.5 },
            }}
          >
            <Stack spacing={1.25}>
              <Stack alignItems="center" direction="row" spacing={1.5} useFlexGap>
                <Stack alignItems="center" direction="row" spacing={0.75}>
                  <Box sx={{ backgroundColor: theme.palette.primary.main, borderRadius: 999, height: 6, width: 6 }} />
                  <Typography color="text.secondary" sx={{ fontSize: "9px", fontWeight: 600 }}>
                    Dropshipping
                  </Typography>
                </Stack>
                <Stack alignItems="center" direction="row" spacing={0.75}>
                  <Box sx={{ backgroundColor: theme.palette.success.main, borderRadius: 999, height: 6, width: 6 }} />
                  <Typography color="text.secondary" sx={{ fontSize: "9px", fontWeight: 600 }}>
                    Standard Stock-in
                  </Typography>
                </Stack>
              </Stack>
              {isRestricted ? (
                <Stack alignItems="center" justifyContent="center" sx={{ color: "text.secondary", minHeight: chartHeight }}>
                  <Typography variant="body2">Requires an operations role.</Typography>
                </Stack>
              ) : isLoading && !data ? (
                <Skeleton height={chartHeight} variant="rounded" />
              ) : !hasBuckets ? (
                <Stack alignItems="center" justifyContent="center" sx={{ color: "text.secondary", minHeight: chartHeight }}>
                  <Typography variant="body2">No statistics available for this range.</Typography>
                </Stack>
              ) : (
                <Box sx={{ overflowX: "auto", width: "100%" }}>
                  <Box sx={{ minWidth: { xs: 640, md: "100%" } }}>
                    <svg preserveAspectRatio="none" viewBox={`0 0 ${chartWidth} ${chartHeight}`} width="100%">
                      {Array.from({ length: gridLineCount + 1 }, (_, index) => {
                        const value = (yMax / gridLineCount) * (gridLineCount - index);
                        const y = chartPaddingTop + (innerHeight / gridLineCount) * index;
                        return (
                          <g key={`grid-${value}`}>
                            <line
                              stroke={alpha(theme.palette.divider, 0.95)}
                              strokeDasharray="8 8"
                              strokeWidth="1"
                              x1={yAxisWidth}
                              x2={chartWidth - 8}
                              y1={y}
                              y2={y}
                            />
                            <text
                              fill={theme.palette.text.secondary}
                              fontFamily={theme.typography.fontFamily}
                              fontSize="8"
                              textAnchor="end"
                              x={yAxisWidth - 10}
                              y={y + 3}
                            >
                              {formatNumber(value)}
                            </text>
                          </g>
                        );
                      })}

                      <g transform={`translate(${yAxisWidth}, ${chartPaddingTop})`}>
                        <path
                          d={dropshippingPath}
                          fill="none"
                          stroke={theme.palette.primary.main}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2.5"
                        />
                        <path
                          d={stockInPath}
                          fill="none"
                          stroke={theme.palette.success.main}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2.5"
                        />
                      </g>

                      {buckets.map((bucket, index) => {
                        if (index !== 0 && index !== buckets.length - 1 && index % xLabelStep !== 0) {
                          return null;
                        }
                        const x = yAxisWidth + (buckets.length > 1 ? (innerWidth / (buckets.length - 1)) * index : innerWidth / 2);
                        return (
                          <text
                            key={`x-label-${bucket.date}`}
                            fill={theme.palette.text.secondary}
                            fontFamily={theme.typography.fontFamily}
                            fontSize="8"
                            textAnchor="middle"
                            x={x}
                            y={chartHeight - 8}
                          >
                            {formatBucketLabel(bucket.date, buckets.length)}
                          </text>
                        );
                      })}
                    </svg>
                  </Box>
                </Box>
              )}
            </Stack>
          </Box>
          </Stack>
        </CardContent>
      </Card>
      {!isRestricted ? <StorageCapacityCard /> : null}
      <DashboardRevenueOverviewCard
        chargeItems={revenueOverview?.chargeItems ?? []}
        dateFrom={effectiveRange.dateFrom}
        dateTo={effectiveRange.dateTo}
        fundFlows={revenueOverview?.fundFlows ?? []}
        isLoading={isRevenueLoading}
        isRestricted={isRevenueRestricted}
        manualCharges={revenueOverview?.manualCharges ?? []}
        rentDetails={revenueOverview?.rentDetails ?? []}
        vouchers={revenueOverview?.vouchers ?? []}
      />
    </Box>
  );
}
