import { useEffect, useMemo, useState } from "react";

import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import { Box, Card, CardContent, Skeleton, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import { useI18n } from "@/app/ui-preferences";
import type {
  ChargeItemRecord,
  FundFlowRecord,
  ManualChargeRecord,
  RentDetailRecord,
  VoucherRecord,
} from "@/features/fees/model/types";
import { RangePicker } from "@/shared/components/range-picker";
import { formatNumber } from "@/shared/utils/format";

export interface DashboardRevenueOverviewSourceData {
  chargeItems: ChargeItemRecord[];
  fundFlows: FundFlowRecord[];
  manualCharges: ManualChargeRecord[];
  rentDetails: RentDetailRecord[];
  vouchers: VoucherRecord[];
}

interface DashboardRevenueOverviewCardProps extends DashboardRevenueOverviewSourceData {
  dateFrom?: string | null;
  dateTo?: string | null;
  isLoading: boolean;
  isRestricted?: boolean;
}

interface ClientFinanceSignal {
  amount: number;
  currency: string;
  customerId: number;
  customerName: string;
  meta: string;
}

type RevenueBreakdownKey = "rent" | "storage" | "handling" | "other";

const BREAKDOWN_META: { color: string; key: RevenueBreakdownKey; label: string }[] = [
  { color: "#1C63E5", key: "rent", label: "Warehouse rent" },
  { color: "#22A7A5", key: "storage", label: "Storage / stock-in" },
  { color: "#97D816", key: "handling", label: "Handling / stock-out" },
  { color: "#F2C318", key: "other", label: "Other fees" },
];

const INCLUDED_MANUAL_CHARGE_STATUSES = new Set(["PENDING_REVIEW", "APPROVED", "POSTED"]);
const INCLUDED_RENT_STATUSES = new Set(["ACCRUED", "BILLED"]);
const INCLUDED_RECHARGE_FLOW_STATUSES = new Set(["POSTED"]);
const LOW_FUNDS_RATIO_THRESHOLD = 0.2;
const MAX_CLIENT_SIGNALS = 4;

function hasTimeComponent(value: string) {
  return value.includes("T");
}

function parseBoundary(value: string | null | undefined, boundary: "start" | "end") {
  if (!value) {
    return null;
  }

  if (hasTimeComponent(value)) {
    const parsed = new Date(value.length === 16 ? `${value}:00` : value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const [year, month, day] = value.split("-").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  return boundary === "start"
    ? new Date(year, month - 1, day, 0, 0, 0, 0)
    : new Date(year, month - 1, day, 23, 59, 59, 999);
}

function toDateTimeDraftValue(value: string | null | undefined, boundary: "start" | "end") {
  if (!value) {
    return "";
  }

  if (hasTimeComponent(value)) {
    return value.slice(0, 16);
  }

  return `${value}T${boundary === "start" ? "00:00" : "23:00"}`;
}

function roundAmount(value: number) {
  return Math.round(value * 100) / 100;
}

function getCustomerInitials(name: string) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return initials || "?";
}

function getInclusiveDayCount(start: Date, end: Date) {
  const normalizedStart = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const normalizedEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.floor((normalizedEnd.getTime() - normalizedStart.getTime()) / 86_400_000) + 1;
}

function isWithinRange(value: string, rangeStart: Date | null, rangeEnd: Date | null) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  if (rangeStart && date < rangeStart) {
    return false;
  }
  if (rangeEnd && date > rangeEnd) {
    return false;
  }
  return true;
}

function getRentAmountForRange(record: RentDetailRecord, rangeStart: Date | null, rangeEnd: Date | null) {
  const fullAmount = Number(record.amount);
  if (!Number.isFinite(fullAmount) || fullAmount <= 0) {
    return 0;
  }

  if (!rangeStart || !rangeEnd) {
    return fullAmount;
  }

  const periodStart = parseBoundary(record.period_start, "start");
  const periodEnd = parseBoundary(record.period_end, "end");
  if (!periodStart || !periodEnd) {
    return 0;
  }

  const overlapStart = new Date(Math.max(periodStart.getTime(), rangeStart.getTime()));
  const overlapEnd = new Date(Math.min(periodEnd.getTime(), rangeEnd.getTime()));
  if (overlapStart > overlapEnd) {
    return 0;
  }

  const totalDays = getInclusiveDayCount(periodStart, periodEnd);
  const overlapDays = getInclusiveDayCount(overlapStart, overlapEnd);
  if (totalDays <= 0 || overlapDays <= 0) {
    return 0;
  }

  return fullAmount * (overlapDays / totalDays);
}

function getManualChargeBreakdownKey(chargeItemCategory: string | undefined): RevenueBreakdownKey {
  switch (chargeItemCategory) {
    case "RENT":
      return "rent";
    case "STORAGE":
      return "storage";
    case "HANDLING":
    case "LOGISTICS":
      return "handling";
    default:
      return "other";
  }
}

function buildRevenueOverview({
  chargeItems,
  dateFrom,
  dateTo,
  manualCharges,
  rentDetails,
}: DashboardRevenueOverviewSourceData & { dateFrom?: string | null; dateTo?: string | null }) {
  const breakdownTotals: Record<RevenueBreakdownKey, number> = {
    handling: 0,
    other: 0,
    rent: 0,
    storage: 0,
  };
  const chargeItemsById = new Map(chargeItems.map((item) => [item.id, item]));
  const customerIds = new Set<number>();
  const currencies = new Set<string>();
  const rangeStart = parseBoundary(dateFrom, "start");
  const rangeEnd = parseBoundary(dateTo, "end");
  let feeItemCount = 0;

  manualCharges.forEach((record) => {
    if (!INCLUDED_MANUAL_CHARGE_STATUSES.has(record.status) || !isWithinRange(record.charged_at, rangeStart, rangeEnd)) {
      return;
    }

    const amount = Number(record.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }

    const chargeItemCategory = record.charge_item ? chargeItemsById.get(record.charge_item)?.category : undefined;
    breakdownTotals[getManualChargeBreakdownKey(chargeItemCategory)] += amount;
    feeItemCount += 1;
    if (record.customer_account) {
      customerIds.add(record.customer_account);
    }
    if (record.currency) {
      currencies.add(record.currency);
    }
  });

  rentDetails.forEach((record) => {
    if (!INCLUDED_RENT_STATUSES.has(record.status)) {
      return;
    }

    const amount = getRentAmountForRange(record, rangeStart, rangeEnd);
    if (amount <= 0) {
      return;
    }

    breakdownTotals.rent += amount;
    feeItemCount += 1;
    if (record.customer_account) {
      customerIds.add(record.customer_account);
    }
    if (record.currency) {
      currencies.add(record.currency);
    }
  });

  const totalAmount = roundAmount(
    breakdownTotals.rent + breakdownTotals.storage + breakdownTotals.handling + breakdownTotals.other,
  );

  return {
    breakdown: BREAKDOWN_META.map((item) => {
      const amount = roundAmount(breakdownTotals[item.key]);
      return {
        ...item,
        amount,
        share: totalAmount > 0 ? amount / totalAmount : 0,
      };
    }),
    currency: currencies.size === 1 ? [...currencies][0] : currencies.size > 1 ? "Mixed" : "USD",
    customerCount: customerIds.size,
    feeItemCount,
    hasMultipleCurrencies: currencies.size > 1,
    totalAmount,
  };
}

function buildRechargeSignals({
  dateFrom,
  dateTo,
  fundFlows,
  buildMeta,
}: Pick<DashboardRevenueOverviewSourceData, "fundFlows"> & {
  dateFrom?: string | null;
  dateTo?: string | null;
  buildMeta: (count: number) => string;
}) {
  const rangeStart = parseBoundary(dateFrom, "start");
  const rangeEnd = parseBoundary(dateTo, "end");
  const grouped = new Map<number, { amount: number; count: number; currencies: Set<string>; customerName: string }>();

  fundFlows.forEach((record) => {
    if (
      !record.customer_account ||
      !record.customer_account_name ||
      !INCLUDED_RECHARGE_FLOW_STATUSES.has(record.status) ||
      record.flow_type !== "INBOUND" ||
      record.source_type !== "RECHARGE" ||
      !isWithinRange(record.occurred_at, rangeStart, rangeEnd)
    ) {
      return;
    }

    const amount = Number(record.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }

    const current = grouped.get(record.customer_account) ?? {
      amount: 0,
      count: 0,
      currencies: new Set<string>(),
      customerName: record.customer_account_name,
    };
    current.amount += amount;
    current.count += 1;
    if (record.currency) {
      current.currencies.add(record.currency);
    }
    grouped.set(record.customer_account, current);
  });

  return [...grouped.entries()]
    .map(([customerId, value]) => ({
      amount: roundAmount(value.amount),
      currency: value.currencies.size === 1 ? [...value.currencies][0] : "Mixed",
      customerId,
      customerName: value.customerName,
      meta: buildMeta(value.count),
    }))
    .sort((left, right) => right.amount - left.amount)
    .slice(0, MAX_CLIENT_SIGNALS);
}

function buildLowFundSignals({
  vouchers,
  buildMeta,
}: Pick<DashboardRevenueOverviewSourceData, "vouchers"> & {
  buildMeta: (percent: number) => string;
}) {
  const grouped = new Map<number, { currencies: Set<string>; face: number; name: string; remaining: number }>();

  vouchers.forEach((record) => {
    if (
      !record.customer_account ||
      !record.customer_account_name ||
      record.status !== "ACTIVE" ||
      record.voucher_type === "DEDUCTION"
    ) {
      return;
    }

    const remaining = Number(record.remaining_value);
    const face = Number(record.face_value);
    if (!Number.isFinite(remaining) || !Number.isFinite(face) || face <= 0) {
      return;
    }

    const current = grouped.get(record.customer_account) ?? {
      currencies: new Set<string>(),
      face: 0,
      name: record.customer_account_name,
      remaining: 0,
    };
    current.face += face;
    current.remaining += remaining;
    if (record.currency) {
      current.currencies.add(record.currency);
    }
    grouped.set(record.customer_account, current);
  });

  return [...grouped.entries()]
    .map(([customerId, value]) => {
      const remainingRatio = value.face > 0 ? value.remaining / value.face : 0;
      return {
        amount: roundAmount(value.remaining),
        currency: value.currencies.size === 1 ? [...value.currencies][0] : "Mixed",
        customerId,
        customerName: value.name,
        meta: buildMeta(roundAmount(remainingRatio * 100)),
        remainingRatio,
      };
    })
    .filter((item) => item.remainingRatio <= LOW_FUNDS_RATIO_THRESHOLD)
    .sort((left, right) => left.remainingRatio - right.remainingRatio || left.amount - right.amount)
    .slice(0, MAX_CLIENT_SIGNALS)
    .map(({ remainingRatio: _remainingRatio, ...item }) => item);
}

function OverviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <Stack
      spacing={0.25}
      sx={{
        backgroundColor: (theme) => alpha(theme.palette.background.paper, 0.74),
        border: (theme) => `1px solid ${alpha(theme.palette.divider, 0.72)}`,
        borderRadius: "12px",
        minWidth: 0,
        px: 1.1,
        py: 1,
      }}
    >
      <Typography color="text.secondary" sx={{ fontSize: "10px", fontWeight: 700, lineHeight: 1.1 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: "14px", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1 }}>{value}</Typography>
    </Stack>
  );
}

function NoticePill({ label, tone }: { label: string; tone: "error" | "warning" }) {
  return (
    <Box
      sx={{
        backgroundColor: (theme) =>
          tone === "error" ? alpha(theme.palette.error.main, 0.1) : alpha(theme.palette.warning.main, 0.12),
        border: (theme) =>
          `1px solid ${
            tone === "error"
              ? alpha(theme.palette.error.main, 0.28)
              : alpha(theme.palette.warning.main, 0.3)
          }`,
        borderRadius: "999px",
        px: 1,
        py: 0.55,
      }}
    >
      <Typography
        sx={{
          color: tone === "error" ? "error.main" : "warning.main",
          fontSize: "10px",
          fontWeight: 800,
          lineHeight: 1,
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}

function CountBadge({ value }: { value: number }) {
  return (
    <Box
      sx={{
        backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.1),
        border: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.18)}`,
        borderRadius: "999px",
        minWidth: 24,
        px: 0.75,
        py: 0.35,
      }}
    >
      <Typography
        sx={{
          color: "primary.main",
          fontSize: "10px",
          fontWeight: 800,
          lineHeight: 1,
          textAlign: "center",
        }}
      >
        {formatNumber(value)}
      </Typography>
    </Box>
  );
}

function ClientSignalList({
  emptyMessage,
  items,
  title,
}: {
  emptyMessage: string;
  items: ClientFinanceSignal[];
  title: string;
}) {
  const { t } = useI18n();

  return (
    <Stack
      spacing={1}
      sx={{
        backgroundColor: (theme) => alpha(theme.palette.background.paper, 0.96),
        border: (theme) => `1px solid ${alpha(theme.palette.divider, 0.72)}`,
        borderRadius: "12px",
        minHeight: 160,
        p: 1.25,
      }}
    >
      <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={1}>
        <Typography sx={{ fontSize: "11px", fontWeight: 800, letterSpacing: "-0.02em" }}>{title}</Typography>
        <CountBadge value={items.length} />
      </Stack>
      {items.length > 0 ? (
        items.map((item) => (
          <Stack
            direction="row"
            justifyContent="space-between"
            key={`${title}-${item.customerId}`}
            spacing={1.25}
            sx={{
              alignItems: "center",
              borderTop: (theme) => `1px dashed ${alpha(theme.palette.divider, 0.72)}`,
              pt: 0.9,
            }}
          >
            <Stack alignItems="center" direction="row" minWidth={0} spacing={1}>
              <Box
                sx={{
                  alignItems: "center",
                  backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.08),
                  border: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
                  borderRadius: "999px",
                  color: "primary.main",
                  display: "inline-flex",
                  flexShrink: 0,
                  fontSize: "10px",
                  fontWeight: 800,
                  height: 28,
                  justifyContent: "center",
                  width: 28,
                }}
              >
                {getCustomerInitials(item.customerName)}
              </Box>
              <Stack minWidth={0} spacing={0.15}>
                <Typography sx={{ fontSize: "11px", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.25 }} noWrap>
                  {item.customerName}
                </Typography>
                <Typography color="text.secondary" sx={{ fontSize: "10px", fontWeight: 600, lineHeight: 1.2 }}>
                  {item.meta}
                </Typography>
              </Stack>
            </Stack>
            <Stack alignItems="flex-end" spacing={0.05}>
              <Typography sx={{ fontSize: "12px", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.15, textAlign: "right" }}>
                {formatNumber(item.amount)}
              </Typography>
              <Typography color="text.secondary" sx={{ fontSize: "10px", fontWeight: 700, lineHeight: 1 }}>
                {item.currency === "Mixed" ? t("Mixed") : item.currency}
              </Typography>
            </Stack>
          </Stack>
        ))
      ) : (
        <Stack alignItems="center" justifyContent="center" sx={{ color: "text.secondary", flex: 1 }}>
          <Typography sx={{ fontSize: "11px", fontWeight: 600, textAlign: "center" }}>{emptyMessage}</Typography>
        </Stack>
      )}
    </Stack>
  );
}

export function DashboardRevenueOverviewCard({
  chargeItems,
  dateFrom,
  dateTo,
  fundFlows,
  isLoading,
  isRestricted = false,
  manualCharges,
  rentDetails,
  vouchers,
}: DashboardRevenueOverviewCardProps) {
  const theme = useTheme();
  const { t, translate } = useI18n();
  const [draftDateFrom, setDraftDateFrom] = useState(toDateTimeDraftValue(dateFrom, "start"));
  const [draftDateTo, setDraftDateTo] = useState(toDateTimeDraftValue(dateTo, "end"));

  useEffect(() => {
    setDraftDateFrom(toDateTimeDraftValue(dateFrom, "start"));
    setDraftDateTo(toDateTimeDraftValue(dateTo, "end"));
  }, [dateFrom, dateTo]);

  const selectedRangeStart = parseBoundary(draftDateFrom || dateFrom, "start");
  const selectedRangeEnd = parseBoundary(draftDateTo || dateTo, "end");
  const isInvalidRange =
    selectedRangeStart !== null &&
    selectedRangeEnd !== null &&
    selectedRangeStart.getTime() > selectedRangeEnd.getTime();
  const effectiveDateFrom = !isInvalidRange ? draftDateFrom || dateFrom : dateFrom;
  const effectiveDateTo = !isInvalidRange ? draftDateTo || dateTo : dateTo;
  const revenueOverview = useMemo(
    () => buildRevenueOverview({ chargeItems, dateFrom: effectiveDateFrom, dateTo: effectiveDateTo, fundFlows, manualCharges, rentDetails, vouchers }),
    [chargeItems, effectiveDateFrom, effectiveDateTo, fundFlows, manualCharges, rentDetails, vouchers],
  );
  const rechargeSignals = useMemo(
    () =>
      buildRechargeSignals({
        dateFrom: effectiveDateFrom,
        dateTo: effectiveDateTo,
        fundFlows,
        buildMeta: (count) => t("{{count}}x recharge", { count: formatNumber(count) }),
      }),
    [effectiveDateFrom, effectiveDateTo, fundFlows, t],
  );
  const lowFundSignals = useMemo(
    () =>
      buildLowFundSignals({
        vouchers,
        buildMeta: (percent) => t("{{percent}}% left", { percent: formatNumber(percent) }),
      }),
    [t, vouchers],
  );
  const renderCurrencyLabel = (currency: string) => (currency === "Mixed" ? t("Mixed") : currency);

  return (
    <Card
      sx={{
        background: `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.99)} 0%, ${alpha(theme.palette.background.default, 0.9)} 100%)`,
        border: `1px solid ${alpha(theme.palette.divider, 0.92)}`,
        borderRadius: "14px",
        boxShadow: "none",
        gridColumn: { xs: "auto", lg: "1 / -1" },
        minWidth: 0,
      }}
    >
      <CardContent sx={{ p: { xs: 2, md: 2.25 }, "&:last-child": { pb: { xs: 2, md: 2.25 } } }}>
        <Stack spacing={2.25}>
          <Stack
            alignItems={{ xs: "flex-start", md: "center" }}
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            spacing={1.5}
          >
            <Stack alignItems="center" direction="row" spacing={1}>
              <Box
                sx={{
                  alignItems: "center",
                  backgroundColor: alpha(theme.palette.success.main, 0.12),
                  border: `1px solid ${alpha(theme.palette.success.main, 0.22)}`,
                  borderRadius: "10px",
                  color: theme.palette.success.main,
                  display: "inline-flex",
                  height: 28,
                  justifyContent: "center",
                  width: 28,
                }}
              >
                <AccountBalanceWalletOutlinedIcon sx={{ fontSize: 16 }} />
              </Box>
              <Typography
                sx={{
                  fontSize: "14px",
                  fontWeight: 800,
                  letterSpacing: "-0.04em",
                  lineHeight: 1.1,
                }}
              >
                {t("Generated Revenue")}
              </Typography>
            </Stack>

            {!isRestricted ? (
              <Stack spacing={1} sx={{ width: { xs: "100%", md: "auto" } }}>
                <RangePicker
                  endAriaLabel={t("Revenue range end")}
                  endValue={draftDateTo}
                  error={isInvalidRange}
                  inputType="datetime-local"
                  onEndChange={setDraftDateTo}
                  onStartChange={setDraftDateFrom}
                  startAriaLabel={t("Revenue range start")}
                  startValue={draftDateFrom}
                  step={3600}
                />
              </Stack>
            ) : null}
          </Stack>

          {isRestricted ? (
            <Stack alignItems="center" justifyContent="center" sx={{ color: "text.secondary", minHeight: 164 }}>
              <Typography variant="body2">{t("Requires a finance role.")}</Typography>
            </Stack>
          ) : isLoading ? (
            <Skeleton height={288} variant="rounded" />
          ) : (
            <Stack spacing={2.25}>
              <Stack direction={{ xs: "column", lg: "row" }} spacing={2.25}>
                <Stack
                  spacing={1.4}
                  sx={{
                    background: `linear-gradient(180deg, ${alpha(theme.palette.success.main, 0.08)} 0%, ${alpha(theme.palette.background.paper, 0.92)} 100%)`,
                    border: `1px solid ${alpha(theme.palette.divider, 0.72)}`,
                    borderRadius: "16px",
                    minWidth: { lg: 276 },
                    p: 1.5,
                    width: { xs: "100%", lg: 276 },
                  }}
                >
                  <Typography color="text.secondary" sx={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase" }}>
                    {t("Revenue")}
                  </Typography>
                  <Stack alignItems="baseline" direction="row" flexWrap="wrap" gap={1}>
                    <Typography
                      sx={{
                        fontSize: { xs: "36px", md: "44px" },
                        fontWeight: 800,
                        letterSpacing: "-0.06em",
                        lineHeight: 0.92,
                      }}
                    >
                      {formatNumber(revenueOverview.totalAmount)}
                    </Typography>
                    <Box
                      sx={{
                        backgroundColor: alpha(theme.palette.background.default, 0.82),
                        border: `1px solid ${alpha(theme.palette.divider, 0.72)}`,
                        borderRadius: "999px",
                        px: 0.9,
                        py: 0.45,
                      }}
                    >
                      <Typography sx={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.04em" }}>
                        {renderCurrencyLabel(revenueOverview.currency)}
                      </Typography>
                    </Box>
                  </Stack>
                  <Box
                    sx={{
                      display: "grid",
                      gap: 0.9,
                      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    }}
                  >
                    <OverviewMetric label={t("Clients")} value={formatNumber(revenueOverview.customerCount)} />
                    <OverviewMetric label={t("Fees")} value={formatNumber(revenueOverview.feeItemCount)} />
                  </Box>
                  {revenueOverview.feeItemCount === 0 ? (
                    <Typography color="text.secondary" sx={{ fontSize: "11px", fontWeight: 600, lineHeight: 1.35 }}>
                      {t("No fees in range.")}
                    </Typography>
                  ) : null}
                  <Stack direction="row" flexWrap="wrap" gap={0.75} useFlexGap>
                    {isInvalidRange ? <NoticePill label={t("Invalid range")} tone="error" /> : null}
                    {revenueOverview.hasMultipleCurrencies ? <NoticePill label={t("Mixed currencies")} tone="warning" /> : null}
                  </Stack>
                </Stack>

                <Stack
                  flex={1}
                  minWidth={0}
                  spacing={1.25}
                  sx={{
                    backgroundColor: alpha(theme.palette.background.paper, 0.84),
                    border: `1px solid ${alpha(theme.palette.divider, 0.72)}`,
                    borderRadius: "16px",
                    p: 1.5,
                  }}
                >
                  <Box
                    sx={{
                      backgroundColor: alpha(theme.palette.background.default, 0.68),
                      borderRadius: "999px",
                      display: "flex",
                      gap: 0.25,
                      height: 12,
                      overflow: "hidden",
                      p: 0.25,
                    }}
                  >
                    {revenueOverview.totalAmount > 0 ? (
                      revenueOverview.breakdown
                        .filter((item) => item.amount > 0)
                        .map((item) => (
                          <Box
                            key={`${item.key}-segment`}
                            sx={{
                              backgroundColor: item.color,
                              borderRadius: "999px",
                              width: `${Math.max(item.share * 100, 6)}%`,
                            }}
                          />
                        ))
                    ) : (
                      <Box
                        sx={{
                          backgroundColor: alpha(theme.palette.divider, 0.72),
                          borderRadius: "999px",
                          flex: 1,
                        }}
                      />
                    )}
                  </Box>

                  <Stack spacing={0.9}>
                    {revenueOverview.breakdown.map((item) => (
                      <Stack
                        alignItems="center"
                        direction="row"
                        key={item.key}
                        spacing={1}
                        sx={{
                          backgroundColor: alpha(theme.palette.background.default, 0.36),
                          borderRadius: "12px",
                          px: 1.1,
                          py: 0.95,
                        }}
                      >
                        <Box
                          sx={{
                            backgroundColor: item.color,
                            borderRadius: "999px",
                            flexShrink: 0,
                            height: 10,
                            width: 10,
                          }}
                        />
                        <Typography
                          sx={{
                            flex: 1,
                            fontSize: "11px",
                            fontWeight: 700,
                            letterSpacing: "-0.02em",
                            lineHeight: 1.2,
                            minWidth: 0,
                          }}
                        >
                          {translate(item.label)}
                        </Typography>
                        <Typography color="text.secondary" sx={{ fontSize: "10px", fontWeight: 700, lineHeight: 1 }}>
                          {formatNumber(item.share * 100)}%
                        </Typography>
                        <Typography sx={{ fontSize: "13px", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1 }}>
                          {formatNumber(item.amount)}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Stack>
              </Stack>

              <Box
                sx={{
                  display: "grid",
                  gap: 1.25,
                  gridTemplateColumns: {
                    xs: "1fr",
                    lg: "repeat(2, minmax(0, 1fr))",
                  },
                }}
              >
                <ClientSignalList
                  emptyMessage={t("No recharge activity.")}
                  items={rechargeSignals}
                  title={t("Recharged")}
                />
                <ClientSignalList
                  emptyMessage={t("No low-balance clients.")}
                  items={lowFundSignals}
                  title={t("Low Balance")}
                />
              </Box>
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
