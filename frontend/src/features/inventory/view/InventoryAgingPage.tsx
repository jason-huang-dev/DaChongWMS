import { useEffect, useMemo, useRef, useState } from "react";

import { useQuery } from "@tanstack/react-query";

import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import KeyboardArrowUpRoundedIcon from "@mui/icons-material/KeyboardArrowUpRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import { Box, Button, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { visuallyHidden } from "@mui/utils";

import { useTenantScope } from "@/app/scope-context";
import { useI18n } from "@/app/ui-preferences";
import type { InventoryInformationRow, StockAgeBucketLabel, StockAgeRow } from "@/features/inventory/model/types";
import { inventoryApi } from "@/features/inventory/model/api";
import {
  buildStockAgeBuckets,
  buildStockAgeRows,
  calculateStockAgeDays,
  compareStockAgeBucketLabels,
  downloadStockAgeRowsCsv,
  resolveStockAgeBucketLabel,
  sumStockAgeQuantity,
} from "@/features/inventory/model/mappers";
import { InventoryProductInfoCell } from "@/features/inventory/view/InventoryProductInfoCell";
import { ActionIconButton } from "@/shared/components/action-icon-button";
import { DataTable, type DataTableColumnDefinition, type DataTableRowSelection } from "@/shared/components/data-table";
import { FieldSelectorFilter } from "@/shared/components/field-selector-filter";
import { FilterCard } from "@/shared/components/filter-card";
import { PageTabs } from "@/shared/components/page-tabs";
import { StickyTableLayout } from "@/shared/components/sticky-table-layout";
import { useCollapsibleTablePageChrome } from "@/shared/hooks/use-collapsible-table-page-chrome";
import { useBulkSelection } from "@/shared/hooks/use-bulk-selection";
import { useDataView, type DataViewFilters, type UseDataViewResult } from "@/shared/hooks/use-data-view";
import { apiGet } from "@/lib/http";
import type { PaginatedResponse } from "@/shared/types/api";
import type { InventoryBalanceRecord } from "@/shared/types/domain";
import { formatNumber } from "@/shared/utils/format";
import { parseApiError } from "@/shared/utils/parse-api-error";

const stockAgeBatchSize = 500;
const stockAgePageSize = 50;

type StockAgeViewMode = "standard" | "segmented";
type StockAgeProductSearchField = "merchantSku" | "merchantCode" | "productBarcode" | "productName";
type StockAgeSummaryTone = "success" | "info" | "warning" | "danger";

interface StockAgeFilters extends DataViewFilters {
  warehouse: string;
  client: string;
  productSearchField: StockAgeProductSearchField;
  productSearchValue: string;
}

interface StockAgeFilterOption {
  label: string;
  value: string;
}

type StockAgeTableRow = Omit<StockAgeRow, "id"> & {
  id: string;
  bucketLabel: StockAgeBucketLabel;
  clientCodes: string[];
  clientLabel: string;
  merchantCode: string;
  merchantSku: string;
  productBarcode: string;
  productName: string;
  sizeLabel: string;
  storageDate: string | null;
  updateTime: string | null;
  warehouseName: string;
};

interface StockAgeSummaryItem {
  label: StockAgeBucketLabel;
  quantity: number;
  skuCount: number;
  tone: StockAgeSummaryTone;
}

const stockAgeTabs = [
  { label: "Standard Stock Age", value: "standard" },
  { label: "Segmented Stock Age", value: "segmented" },
] as const;

const stockAgeProductSearchFieldOptions: Array<{
  label: string;
  value: StockAgeProductSearchField;
}> = [
  { label: "Merchant SKU", value: "merchantSku" },
  { label: "Merchant Code", value: "merchantCode" },
  { label: "Barcode", value: "productBarcode" },
  { label: "Product Name", value: "productName" },
] as const;

const stockAgeProductSearchPlaceholders: Record<StockAgeProductSearchField, string> = {
  merchantSku: "Search merchant SKU",
  merchantCode: "Search merchant code",
  productBarcode: "Search barcode",
  productName: "Search product name",
};

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function buildWarehouseSkuKey(warehouseName: string, merchantSku: string) {
  return `${normalizeText(warehouseName)}::${normalizeText(merchantSku)}`;
}

async function fetchAllInventoryBalances() {
  let page = 1;
  const rows: InventoryBalanceRecord[] = [];

  while (true) {
    const response = await apiGet<PaginatedResponse<InventoryBalanceRecord>>(inventoryApi.balances, {
      page,
      page_size: stockAgeBatchSize,
    });

    rows.push(...response.results);

    if (!response.next || rows.length >= response.count) {
      break;
    }

    page += 1;
  }

  return rows;
}

async function fetchAllInventoryInformationRows(organizationId: number) {
  let page = 1;
  const rows: InventoryInformationRow[] = [];

  while (true) {
    const response = await apiGet<PaginatedResponse<InventoryInformationRow>>(inventoryApi.information(organizationId), {
      page,
      page_size: stockAgeBatchSize,
      sortKey: "merchantSku",
      sortDirection: "asc",
    });

    rows.push(...response.results);

    if (!response.next || rows.length >= response.count) {
      break;
    }

    page += 1;
  }

  return rows;
}

function buildWarehouseOptions(rows: StockAgeTableRow[]): StockAgeFilterOption[] {
  return Array.from(new Set(rows.map((row) => row.warehouseName).filter(Boolean)))
    .sort((left, right) => left.localeCompare(right))
    .map((warehouseName) => ({ label: warehouseName, value: warehouseName }));
}

function buildClientOptions(rows: InventoryInformationRow[]): StockAgeFilterOption[] {
  const clients = new Map<string, string>();

  rows.forEach((row) => {
    if (row.customerCode) {
      clients.set(row.customerCode, row.clients[0]?.label || row.customerCode);
    }

    row.clients.forEach((client) => {
      if (client.code) {
        clients.set(client.code, client.label || client.code);
      }
    });
  });

  return Array.from(clients.entries())
    .sort((left, right) => left[1].localeCompare(right[1]))
    .map(([value, label]) => ({ label, value }));
}

function buildClientCodes(row: InventoryInformationRow) {
  return Array.from(new Set([row.customerCode, ...row.clients.map((client) => client.code)].filter(Boolean)));
}

function buildClientLabel(row: InventoryInformationRow) {
  if (row.clients.length > 0) {
    return row.clients.map((client) => client.label).join(", ");
  }

  return row.customerCode || "--";
}

function buildProductSizeLabel(row: InventoryInformationRow | null) {
  if (!row) {
    return "--";
  }

  const dimensions = [row.actualLength, row.actualWidth, row.actualHeight]
    .map((value) => value?.trim?.() ?? "")
    .filter(Boolean);

  if (dimensions.length !== 3) {
    return "--";
  }

  const unit = row.measurementUnit?.trim?.() ?? "";
  const dimensionLabel = dimensions.map((value) => formatNumber(value)).join(" x ");

  return unit ? `${dimensionLabel} ${unit}` : dimensionLabel;
}

function chooseInventoryInformationRow(stockAgeRow: StockAgeRow, candidates: InventoryInformationRow[]) {
  const normalizedLocationCode = normalizeText(stockAgeRow.location_code);

  return (
    candidates.find((candidate) =>
      [candidate.shelf, ...candidate.shelves].some((shelf) => normalizeText(shelf) === normalizedLocationCode),
    ) ?? candidates[0] ?? null
  );
}

function buildEnrichedStockAgeRows(stockAgeRows: StockAgeRow[], inventoryInformationRows: InventoryInformationRow[]) {
  const inventoryInformationByWarehouseSku = new Map<string, InventoryInformationRow[]>();

  inventoryInformationRows.forEach((row) => {
    const key = buildWarehouseSkuKey(row.warehouseName, row.merchantSku);
    const current = inventoryInformationByWarehouseSku.get(key) ?? [];
    current.push(row);
    inventoryInformationByWarehouseSku.set(key, current);
  });

  return stockAgeRows.map<StockAgeTableRow>((row) => {
    const inventoryInformation =
      chooseInventoryInformationRow(
        row,
        inventoryInformationByWarehouseSku.get(buildWarehouseSkuKey(row.warehouse_name, row.goods_code)) ?? [],
      ) ?? null;
    const storageDate = inventoryInformation?.listingTime || row.storage_date || row.last_activity || row.update_time;
    const merchantSku = inventoryInformation?.merchantSku || row.goods_code;
    const resolvedAgeDays = storageDate ? calculateStockAgeDays(storageDate) : row.age_days;

    return {
      ...row,
      id: String(row.id),
      age_days: resolvedAgeDays,
      bucketLabel: resolveStockAgeBucketLabel(resolvedAgeDays),
      clientCodes: inventoryInformation ? buildClientCodes(inventoryInformation) : [],
      clientLabel: inventoryInformation ? buildClientLabel(inventoryInformation) : "--",
      merchantCode: inventoryInformation?.merchantCode ?? "",
      merchantSku,
      productBarcode: inventoryInformation?.productBarcode ?? "",
      productName: inventoryInformation?.productName || merchantSku,
      sizeLabel: buildProductSizeLabel(inventoryInformation),
      storageDate,
      updateTime: row.update_time || row.last_activity,
      warehouseName: row.warehouse_name || inventoryInformation?.warehouseName || "--",
    };
  });
}

function readStockAgeSearchValue(row: StockAgeTableRow, field: StockAgeProductSearchField) {
  switch (field) {
    case "merchantCode":
      return row.merchantCode;
    case "productBarcode":
      return row.productBarcode;
    case "productName":
      return row.productName;
    case "merchantSku":
    default:
      return row.merchantSku;
  }
}

function filterStockAgeRows(rows: StockAgeTableRow[], filters: StockAgeFilters) {
  const normalizedSearchValue = normalizeText(filters.productSearchValue);

  return rows.filter((row) => {
    if (filters.warehouse && row.warehouseName !== filters.warehouse) {
      return false;
    }

    if (filters.client && !row.clientCodes.includes(filters.client)) {
      return false;
    }

    if (normalizedSearchValue) {
      const fieldValue = normalizeText(readStockAgeSearchValue(row, filters.productSearchField));
      if (!fieldValue.includes(normalizedSearchValue)) {
        return false;
      }
    }

    return true;
  });
}

function sortStockAgeRows(rows: StockAgeTableRow[], viewMode: StockAgeViewMode) {
  return [...rows].sort((left, right) => {
    if (viewMode === "segmented") {
      const bucketDifference = compareStockAgeBucketLabels(left.bucketLabel, right.bucketLabel);
      if (bucketDifference !== 0) {
        return bucketDifference;
      }
    }

    const ageDifference = right.age_days - left.age_days;
    if (ageDifference !== 0) {
      return ageDifference;
    }

    return left.merchantSku.localeCompare(right.merchantSku, undefined, { numeric: true, sensitivity: "base" });
  });
}

function paginateRows(rows: StockAgeTableRow[], page: number, pageSize: number) {
  const start = Math.max(page - 1, 0) * pageSize;
  return rows.slice(start, start + pageSize);
}

function formatDateOnly(value: string | null | undefined) {
  if (!value) {
    return "--";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString();
}

function formatDateTimeParts(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { date: value, time: "" };
  }

  return {
    date: parsed.toLocaleDateString(),
    time: parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
  };
}

function resolveStockAgeSummaryTone(bucketLabel: StockAgeBucketLabel): StockAgeSummaryTone {
  switch (bucketLabel) {
    case "<30":
      return "success";
    case "31-60":
      return "info";
    case "61-90":
      return "warning";
    case "90+":
    default:
      return "danger";
  }
}

function buildStockAgeSummaryToneSx(theme: ReturnType<typeof useTheme>, tone: StockAgeSummaryTone) {
  const isDark = theme.palette.mode === "dark";
  const accentColor =
    tone === "success"
      ? theme.palette.success.main
      : tone === "info"
        ? theme.palette.info.main
        : tone === "warning"
          ? theme.palette.warning.main
          : theme.palette.error.main;

  return {
    accentColor,
    backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.72 : 0.94),
    borderColor: alpha(accentColor, isDark ? 0.28 : 0.18),
    labelColor: isDark ? alpha(accentColor, 0.9) : alpha(accentColor, 0.96),
  };
}

function buildStockAgeSummaryItems(rows: StockAgeTableRow[]): StockAgeSummaryItem[] {
  return buildStockAgeBuckets(rows).map((bucket) => ({
    label: bucket.label,
    quantity: bucket.quantity,
    skuCount: bucket.count,
    tone: resolveStockAgeSummaryTone(bucket.label),
  }));
}

function StockAgeSummaryStrip({
  isCollapsed,
  onToggleCollapsed,
  rows,
}: {
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  rows: StockAgeTableRow[];
}) {
  const theme = useTheme();
  const { t, translate } = useI18n();
  const isDark = theme.palette.mode === "dark";
  const summaryItems = useMemo(() => buildStockAgeSummaryItems(rows), [rows]);
  const totalSkuCount = useMemo(
    () => formatNumber(new Set(rows.map((row) => row.merchantSku || row.goods_code)).size),
    [rows],
  );
  const totalQuantity = useMemo(() => formatNumber(sumStockAgeQuantity(rows)), [rows]);

  return (
    <Box
      sx={{
        backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.82 : 0.97),
        border: `1px solid ${alpha(theme.palette.divider, isDark ? 0.42 : 0.72)}`,
        borderRadius: 3,
        overflow: "hidden",
      }}
    >
      <Stack
        alignItems="center"
        direction="row"
        justifyContent="space-between"
        spacing={1}
        sx={{ minWidth: 0, px: 1.25, py: 0.8 }}
      >
        <Stack alignItems="center" direction="row" spacing={1} sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: theme.typography.pxToRem(12), fontWeight: 800 }} variant="body2">
            {t("Stock age summary")}
          </Typography>
          <Typography color="text.secondary" sx={{ fontSize: theme.typography.pxToRem(12) }} variant="body2">
            {`${totalSkuCount} ${t("SKU")} / ${totalQuantity} ${t("Qty")}`}
          </Typography>
        </Stack>
        <ActionIconButton
          aria-label={isCollapsed ? t("Expand stock age summary") : t("Collapse stock age summary")}
          onClick={onToggleCollapsed}
          title={isCollapsed ? t("Expand stock age summary") : t("Collapse stock age summary")}
        >
          {isCollapsed ? <KeyboardArrowDownRoundedIcon fontSize="small" /> : <KeyboardArrowUpRoundedIcon fontSize="small" />}
        </ActionIconButton>
      </Stack>
      {isCollapsed ? null : (
        <Box
          sx={{
            borderTop: `1px solid ${alpha(theme.palette.divider, isDark ? 0.28 : 0.62)}`,
            overflowX: "auto",
            overflowY: "hidden",
            px: 1.25,
            py: 0.8,
            scrollbarWidth: "thin",
            "&::-webkit-scrollbar": {
              height: 6,
            },
            "&::-webkit-scrollbar-thumb": {
              backgroundColor: alpha(theme.palette.text.primary, 0.14),
              borderRadius: 999,
            },
          }}
        >
          <Box
            sx={{
              display: "flex",
              flexWrap: "nowrap",
              gap: 0.75,
              minWidth: "max-content",
            }}
          >
            {summaryItems.map((item) => {
              const toneSx = buildStockAgeSummaryToneSx(theme, item.tone);

              return (
                <Box
                  key={item.label}
                  sx={{
                    alignItems: "center",
                    backgroundColor: toneSx.backgroundColor,
                    border: `1px solid ${toneSx.borderColor}`,
                    borderRadius: 999,
                    display: "inline-flex",
                    flex: "0 0 auto",
                    gap: 0.85,
                    minHeight: 34,
                    px: 1,
                    py: 0.35,
                    whiteSpace: "nowrap",
                  }}
                >
                  <Box
                    sx={{
                      backgroundColor: toneSx.accentColor,
                      borderRadius: "50%",
                      flex: "0 0 auto",
                      height: 7,
                      width: 7,
                    }}
                  />
                  <Typography
                    sx={{
                      color: toneSx.labelColor,
                      fontSize: theme.typography.pxToRem(11.5),
                      fontWeight: 800,
                      letterSpacing: "-0.01em",
                    }}
                    variant="body2"
                  >
                    {item.label}
                  </Typography>
                  <Typography
                    sx={{
                      color: theme.palette.text.primary,
                      fontSize: theme.typography.pxToRem(11.5),
                      fontWeight: 700,
                    }}
                    variant="body2"
                  >
                    {formatNumber(item.skuCount)} {t("SKU")}
                  </Typography>
                  <Typography
                    color="text.secondary"
                    sx={{
                      fontSize: theme.typography.pxToRem(11.5),
                      fontWeight: 600,
                    }}
                    variant="body2"
                  >
                    {formatNumber(item.quantity)} {t("Qty")}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>
      )}
    </Box>
  );
}

function InventoryAgingFilters({
  clientOptions,
  dataView,
  viewMode,
  warehouseOptions,
  onViewModeChange,
}: {
  clientOptions: StockAgeFilterOption[];
  dataView: UseDataViewResult<StockAgeFilters>;
  viewMode: StockAgeViewMode;
  warehouseOptions: StockAgeFilterOption[];
  onViewModeChange: (value: StockAgeViewMode) => void;
}) {
  const theme = useTheme();
  const { t, translate } = useI18n();
  const isDark = theme.palette.mode === "dark";
  const standaloneFieldSx = {
    minWidth: 0,
    width: "100%",
    "& .MuiInputBase-input": {
      fontSize: theme.typography.pxToRem(13),
      py: 0.9,
    },
    "& .MuiOutlinedInput-root": {
      backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.48 : 0.96),
      borderRadius: 1.5,
      height: 44,
      minHeight: 44,
    },
  } as const;
  const compoundFieldSx = {
    "& .MuiInputBase-input": {
      fontSize: theme.typography.pxToRem(13),
      py: 0.75,
    },
    "& .MuiOutlinedInput-root": {
      backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.48 : 0.96),
      borderRadius: 999,
      height: 34,
      minHeight: 34,
    },
  } as const;

  return (
    <FilterCard
      contentSx={{
        pb: "16px !important",
        pt: 1.5,
      }}
      header={
        <PageTabs
          ariaLabel={t("Stock age views")}
          items={stockAgeTabs.map((tab) => ({ ...tab, label: translate(tab.label) }))}
          onChange={onViewModeChange}
          value={viewMode}
        />
      }
    >
      <Box
        sx={{
          alignItems: "stretch",
          display: "grid",
          gap: 1,
          gridTemplateColumns: {
            lg: "220px 220px minmax(0, 1fr)",
            md: "repeat(2, minmax(0, 1fr))",
            xs: "minmax(0, 1fr)",
          },
          minWidth: 0,
        }}
      >
        <TextField
          hiddenLabel
          onChange={(event) => dataView.updateFilter("warehouse", event.target.value)}
          select
          size="small"
          value={dataView.filters.warehouse}
          slotProps={{
            htmlInput: {
              "aria-label": t("Warehouse"),
            },
          }}
          sx={standaloneFieldSx}
        >
          <MenuItem value="">{t("All Warehouses")}</MenuItem>
          {warehouseOptions.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          hiddenLabel
          onChange={(event) => dataView.updateFilter("client", event.target.value)}
          select
          size="small"
          value={dataView.filters.client}
          slotProps={{
            htmlInput: {
              "aria-label": t("Client"),
            },
          }}
          sx={standaloneFieldSx}
        >
          <MenuItem value="">{t("All Clients")}</MenuItem>
          {clientOptions.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
        <FieldSelectorFilter
          sx={{
            minHeight: 44,
            px: 0.75,
            py: 0.45,
          }}
        >
          <TextField
            hiddenLabel
            onChange={(event) =>
              dataView.updateFilter("productSearchField", event.target.value as StockAgeProductSearchField)
            }
            select
            size="small"
            value={dataView.filters.productSearchField}
            slotProps={{
              htmlInput: {
                "aria-label": t("Product info field"),
              },
            }}
            sx={{
              flex: "0 0 170px",
              minWidth: 170,
              width: 170,
              ...compoundFieldSx,
            }}
          >
            {stockAgeProductSearchFieldOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {translate(option.label)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            hiddenLabel
            onChange={(event) => dataView.updateFilter("productSearchValue", event.target.value)}
            placeholder={translate(stockAgeProductSearchPlaceholders[dataView.filters.productSearchField])}
            size="small"
            value={dataView.filters.productSearchValue}
            slotProps={{
              htmlInput: {
                "aria-label": t("Search"),
                autoCapitalize: "none",
                autoCorrect: "off",
                spellCheck: false,
              },
            }}
            sx={{
              flex: "1 1 280px",
              minWidth: 180,
              ...compoundFieldSx,
            }}
          />
        </FieldSelectorFilter>
      </Box>
    </FilterCard>
  );
}

function InventoryAgingTableToolbar({
  activeFilterCount,
  onClearSelection,
  onExport,
  onResetFilters,
  selectedCount,
  total,
}: {
  activeFilterCount: number;
  onClearSelection: () => void;
  onExport: () => void;
  onResetFilters: () => void;
  selectedCount: number;
  total: number;
}) {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <Stack
      alignItems={{ xs: "stretch", md: "center" }}
      direction={{ xs: "column", md: "row" }}
      justifyContent="space-between"
      spacing={0.75}
      sx={{ minWidth: 0 }}
    >
      <Stack
        alignItems={{ xs: "stretch", md: "center" }}
        direction={{ xs: "column", md: "row" }}
        spacing={0.75}
        sx={{ flex: "1 1 auto", minWidth: 0 }}
      >
        <Typography sx={{ fontSize: theme.typography.pxToRem(12), fontWeight: 700 }} variant="body2">
          {t("bulk.selectedCount", { count: selectedCount })}
        </Typography>
        <Typography color="text.secondary" sx={{ fontSize: theme.typography.pxToRem(12) }} variant="body2">
          {t("inventory.resultCount", { count: total })}
        </Typography>
        {selectedCount > 0 ? (
          <Button color="inherit" onClick={onClearSelection} size="small">
            {t("Clear selection")}
          </Button>
        ) : null}
      </Stack>
      <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", flexWrap: "wrap" }}>
        <Button
          color="inherit"
          onClick={onExport}
          size="small"
          startIcon={<DownloadOutlinedIcon fontSize="small" />}
        >
          {t("Export")}
        </Button>
        <ActionIconButton
          aria-label={t("Clear all filters")}
          disabled={activeFilterCount === 0}
          onClick={onResetFilters}
          title={t("Clear all filters")}
        >
          <RestartAltRoundedIcon fontSize="small" />
        </ActionIconButton>
      </Stack>
    </Stack>
  );
}

function buildStockAgeColumns(
  t: (key: string, variables?: Record<string, string | number>) => string,
  viewMode: StockAgeViewMode,
): Array<DataTableColumnDefinition<StockAgeTableRow>> {
  const baseColumns: Array<DataTableColumnDefinition<StockAgeTableRow>> = [
    {
      header: t("Product Info"),
      key: "productInfo",
      minWidth: 280,
      sticky: "left",
      width: "28%",
      render: (row) => (
        <InventoryProductInfoCell
          product={{
            merchantCode: row.merchantCode,
            merchantSku: row.merchantSku,
            productBarcode: row.productBarcode,
            productName: row.productName,
          }}
        />
      ),
    },
    {
      header: t("Product Size"),
      key: "size",
      minWidth: 160,
      width: "14%",
      render: (row) => (
        <Typography sx={{ fontWeight: 600 }} variant="body2">
          {row.sizeLabel}
        </Typography>
      ),
    },
    {
      header: t("Warehouse"),
      key: "warehouse",
      minWidth: 92,
      width: "8%",
      render: (row) => (
        <Typography sx={{ fontWeight: 600 }} variant="body2">
          {row.warehouseName}
        </Typography>
      ),
    },
    {
      header: t("Client"),
      key: "client",
      minWidth: 140,
      width: "12%",
      render: (row) => (
        <Typography sx={{ fontWeight: 600 }} variant="body2">
          {row.clientLabel}
        </Typography>
      ),
    },
    {
      header: t("Storage Date"),
      key: "storageDate",
      minWidth: 116,
      width: "10%",
      render: (row) => (
        <Typography sx={{ fontWeight: 600 }} variant="body2">
          {formatDateOnly(row.storageDate)}
        </Typography>
      ),
    },
    {
      align: "right",
      header: t("Qty"),
      key: "quantity",
      minWidth: 76,
      width: "8%",
      render: (row) => (
        <Typography sx={{ fontWeight: 700 }} variant="body2">
          {formatNumber(row.on_hand_qty)}
        </Typography>
      ),
    },
    {
      align: "right",
      header: t("Stock Age (Day)"),
      key: "age",
      minWidth: 110,
      width: "10%",
      render: (row) => (
        <Typography sx={{ fontWeight: 700 }} variant="body2">
          {formatNumber(row.age_days)}
        </Typography>
      ),
    },
    {
      header: t("Update Time"),
      key: "updated",
      minWidth: 140,
      width: "10%",
      render: (row) => {
        const value = formatDateTimeParts(row.updateTime);

        if (!value) {
          return (
            <Typography color="text.secondary" variant="body2">
              --
            </Typography>
          );
        }

        return (
          <Stack spacing={0.1}>
            <Typography sx={{ fontWeight: 600 }} variant="body2">
              {value.date}
            </Typography>
            {value.time ? (
              <Typography color="text.secondary" variant="caption">
                {value.time}
              </Typography>
            ) : null}
          </Stack>
        );
      },
    },
  ];

  if (viewMode !== "segmented") {
    return baseColumns;
  }

  return [
    {
      align: "center",
      header: t("Age Band"),
      key: "bucket",
      minWidth: 90,
      width: "8%",
      render: (row) => (
        <Typography sx={{ fontWeight: 700 }} variant="body2">
          {row.bucketLabel}
        </Typography>
      ),
    },
    ...baseColumns,
  ];
}

export function InventoryAgingPage() {
  const { company, activeWarehouse } = useTenantScope();
  const { t } = useI18n();
  const pageChrome = useCollapsibleTablePageChrome();
  const warehouseFilterInitializedRef = useRef(false);
  const companyId = company?.id !== undefined && company?.id !== null ? Number(company.id) : null;
  const [viewMode, setViewMode] = useState<StockAgeViewMode>("standard");
  const [isSummaryCollapsed, setIsSummaryCollapsed] = useState(false);
  const rowSelectionState = useBulkSelection<string>();
  const agingView = useDataView<StockAgeFilters>({
    viewKey: `inventory-aging.${company?.openid ?? "anonymous"}`,
    defaultFilters: {
      warehouse: "",
      client: "",
      productSearchField: "merchantSku",
      productSearchValue: "",
    },
    pageSize: stockAgePageSize,
  });

  const balancesQuery = useQuery({
    queryKey: ["inventory", "aging", "balances", "all"],
    queryFn: fetchAllInventoryBalances,
  });

  const inventoryInformationQuery = useQuery({
    queryKey: ["inventory", "aging", "information", companyId],
    queryFn: () => fetchAllInventoryInformationRows(companyId ?? 0),
    enabled: Boolean(companyId),
  });

  useEffect(() => {
    if (warehouseFilterInitializedRef.current || !activeWarehouse?.warehouse_name) {
      return;
    }

    agingView.updateFilter("warehouse", activeWarehouse.warehouse_name);
    warehouseFilterInitializedRef.current = true;
  }, [activeWarehouse?.warehouse_name, agingView.updateFilter]);

  const stockAgeRows = useMemo(() => buildStockAgeRows(balancesQuery.data ?? []), [balancesQuery.data]);
  const enrichedRows = useMemo(
    () => buildEnrichedStockAgeRows(stockAgeRows, inventoryInformationQuery.data ?? []),
    [inventoryInformationQuery.data, stockAgeRows],
  );
  const warehouseOptions = useMemo(() => buildWarehouseOptions(enrichedRows), [enrichedRows]);
  const clientOptions = useMemo(() => buildClientOptions(inventoryInformationQuery.data ?? []), [inventoryInformationQuery.data]);
  const filteredRows = useMemo(() => filterStockAgeRows(enrichedRows, agingView.filters), [agingView.filters, enrichedRows]);
  const sortedRows = useMemo(() => sortStockAgeRows(filteredRows, viewMode), [filteredRows, viewMode]);
  const rows = useMemo(() => paginateRows(sortedRows, agingView.page, agingView.pageSize), [agingView.page, agingView.pageSize, sortedRows]);
  const rowsById = useMemo(() => Object.fromEntries(sortedRows.map((row) => [row.id, row])), [sortedRows]);
  const selectedRows = useMemo(
    () =>
      rowSelectionState.selectedIds
        .map((id) => rowsById[id])
        .filter((row): row is StockAgeTableRow => Boolean(row)),
    [rowSelectionState.selectedIds, rowsById],
  );
  const columns = useMemo(() => buildStockAgeColumns(t, viewMode), [t, viewMode]);
  const tableError = balancesQuery.error ? parseApiError(balancesQuery.error) : null;

  useEffect(() => {
    rowSelectionState.clearSelection();
  }, [agingView.queryFilters, rowSelectionState.clearSelection, viewMode]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(sortedRows.length / agingView.pageSize));
    if (agingView.page > maxPage) {
      agingView.setPage(maxPage);
    }
  }, [agingView.page, agingView.pageSize, agingView.setPage, sortedRows.length]);

  const rowSelection = useMemo<DataTableRowSelection<StockAgeTableRow>>(
    () => ({
      selectedRowIds: rowSelectionState.selectedIds,
      onToggleAll: (tableRows) => rowSelectionState.toggleMany(tableRows.map((row) => row.id)),
      onToggleRow: (row) => rowSelectionState.toggleOne(row.id),
    }),
    [rowSelectionState.selectedIds, rowSelectionState.toggleMany, rowSelectionState.toggleOne],
  );

  const handleExport = () => {
    const exportRows = selectedRows.length > 0 ? selectedRows : sortedRows;
    downloadStockAgeRowsCsv(
      exportRows,
      selectedRows.length > 0 ? "stock-age-selected" : "stock-age-filtered",
    );
  };

  return (
    <StickyTableLayout
      pageChrome={
        <Box
          aria-hidden={pageChrome.isCollapsed}
          data-collapse-progress="0.00"
          ref={pageChrome.wrapperRef}
          sx={pageChrome.wrapperSx}
        >
          <Box ref={pageChrome.contentRef}>
            <Stack spacing={1.25}>
              <Typography component="h1" sx={visuallyHidden} variant="h5">
                {t("Stock Age Report")}
              </Typography>
              <StockAgeSummaryStrip
                isCollapsed={isSummaryCollapsed}
                onToggleCollapsed={() => setIsSummaryCollapsed((current) => !current)}
                rows={filteredRows}
              />
              <InventoryAgingFilters
                clientOptions={clientOptions}
                dataView={agingView}
                viewMode={viewMode}
                warehouseOptions={warehouseOptions}
                onViewModeChange={setViewMode}
              />
            </Stack>
          </Box>
        </Box>
      }
      spacing={1.5}
      table={
        <DataTable
          columns={columns}
          emptyMessage={t("No stock age rows match the current filters.")}
          error={tableError}
          fillHeight
          getRowId={(row) => row.id}
          isLoading={balancesQuery.isLoading || (companyId !== null && inventoryInformationQuery.isLoading)}
          pagination={{
            page: agingView.page,
            pageSize: agingView.pageSize,
            total: sortedRows.length,
            onPageChange: agingView.setPage,
          }}
          rowSelection={rowSelection}
          rows={rows}
          stickyHeader
          toolbar={
            <InventoryAgingTableToolbar
              activeFilterCount={agingView.activeFilterCount}
              onClearSelection={rowSelectionState.clearSelection}
              onExport={handleExport}
              onResetFilters={agingView.resetFilters}
              selectedCount={rowSelectionState.selectedIds.length}
              total={sortedRows.length}
            />
          }
          toolbarPlacement="inner"
          onScrollStateChange={pageChrome.handleTableScrollStateChange}
        />
      }
    />
  );
}
