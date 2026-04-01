import { useMemo, useState, type ReactNode } from "react";

import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import {
  Autocomplete,
  Box,
  Checkbox,
  Dialog,
  DialogContent,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import { useI18n } from "@/app/ui-preferences";
import {
  decodeInventoryInformationMultiValue,
  encodeInventoryInformationMultiValue,
} from "@/features/inventory/model/inventory-information";
import type { InventoryInformationRow, InventoryInformationSortKey } from "@/features/inventory/model/types";
import { ResourceTable, type ResourceTableRowSelection } from "@/shared/components/resource-table";
import type { DataViewFilters, UseDataViewResult } from "@/shared/hooks/use-data-view";
import { formatNumber } from "@/shared/utils/format";

export interface InventoryInformationFilters extends DataViewFilters {
  query: string;
  warehouses: string;
  tags: string;
  clients: string;
  merchantSkus: string;
  inventoryCountMin: string;
  inventoryCountMax: string;
}

export interface InventoryInformationFilterOption {
  value: string;
  label: string;
}

function renderValue(value: string) {
  return value || "--";
}

function InventoryClientInfoCell({ row }: { row: InventoryInformationRow }) {
  const theme = useTheme();
  const client = row.clients[0] ?? null;

  if (!client) {
    return "--";
  }

  return (
    <Typography
      sx={{
        color: theme.palette.mode === "dark" ? theme.palette.common.white : theme.palette.common.black,
        fontWeight: 700,
        lineHeight: 1.3,
        whiteSpace: "nowrap",
      }}
      variant="body2"
    >
      {client.label}
    </Typography>
  );
}

function buildProductThumbnailLabel(row: InventoryInformationRow) {
  const source = row.productName || row.merchantSku || row.merchantCode || "Product";
  const tokens = source
    .split(/[\s_-]+/u)
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    return "PR";
  }

  if (tokens.length === 1) {
    return tokens[0].slice(0, 2).toUpperCase();
  }

  return `${tokens[0][0] ?? ""}${tokens[1][0] ?? ""}`.toUpperCase();
}

function renderProductDetail(label: string, value: string, separator: string) {
  return (
    <Box
      sx={{
        alignItems: "baseline",
        display: "flex",
        gap: 0.35,
        minWidth: 0,
        whiteSpace: "nowrap",
        width: "100%",
      }}
    >
      <Typography
        component="span"
        color="text.secondary"
        sx={(theme) => ({
          fontSize: theme.typography.body2.fontSize,
          fontWeight: 700,
          lineHeight: 1.15,
          whiteSpace: "nowrap",
        })}
        variant="body2"
      >
        {label}
        {separator}
      </Typography>
      <Typography
        component="span"
        sx={(theme) => ({
          color: theme.palette.mode === "dark" ? theme.palette.common.white : theme.palette.common.black,
          fontSize: theme.typography.body2.fontSize,
          fontWeight: 800,
          lineHeight: 1.2,
          overflowWrap: "normal",
          whiteSpace: "nowrap",
        })}
        variant="body2"
      >
        {renderValue(value)}
      </Typography>
    </Box>
  );
}

function InventoryProductInfoCell({ row }: { row: InventoryInformationRow }) {
  const theme = useTheme();
  const { locale, translateText } = useI18n();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const primaryMerchantCode = row.merchantCode;
  const thumbnailLabel = buildProductThumbnailLabel(row);
  const detailSeparator = locale === "zh-CN" ? "：" : ":";

  return (
    <Box
      sx={{
        alignItems: "center",
        display: "grid",
        gap: 0.625,
        gridTemplateColumns: "48px minmax(0, 1fr)",
        justifyItems: "start",
        width: "100%",
      }}
    >
      <Box
        sx={(theme) => ({
          alignItems: "center",
          alignSelf: "stretch",
          background: `linear-gradient(160deg, ${alpha(theme.palette.primary.main, 0.14)} 0%, ${alpha(theme.palette.secondary.main, 0.1)} 100%)`,
          border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
          borderRadius: 2,
          display: "flex",
          justifyContent: "center",
          minHeight: 0,
          overflow: "hidden",
          px: 0.375,
          py: 0.5,
          width: 48,
        })}
      >
        <Box
          aria-label={translateText("Open product image preview")}
          component="button"
          onClick={() => setIsPreviewOpen(true)}
          sx={{
            alignItems: "center",
            appearance: "none",
            background: "transparent",
            border: 0,
            color: "inherit",
            cursor: "zoom-in",
            display: "flex",
            height: "100%",
            justifyContent: "center",
            m: 0,
            p: 0,
            width: "100%",
          }}
        >
          <Stack alignItems="center" spacing={0.4}>
            <Inventory2RoundedIcon color="action" sx={{ fontSize: 13 }} />
            <Typography
              sx={{
                color: theme.palette.mode === "dark" ? theme.palette.common.white : theme.palette.common.black,
                fontSize: theme.typography.body2.fontSize,
                fontWeight: 800,
                letterSpacing: "-0.01em",
                lineHeight: 1,
              }}
            >
              {thumbnailLabel}
            </Typography>
          </Stack>
        </Box>
      </Box>
      <Box
        sx={{
          alignItems: "flex-start",
          display: "flex",
          flexDirection: "column",
          gap: 0.15,
          justifyContent: "center",
          minWidth: 0,
          width: "100%",
        }}
      >
        {renderProductDetail(translateText("Code"), primaryMerchantCode, detailSeparator)}
        {renderProductDetail(translateText("SKU"), row.merchantSku, detailSeparator)}
        {renderProductDetail(translateText("Barcode"), row.productBarcode, detailSeparator)}
        {renderProductDetail(translateText("Name"), row.productName || row.merchantSku, detailSeparator)}
      </Box>
      <Dialog onClose={() => setIsPreviewOpen(false)} open={isPreviewOpen}>
        <DialogContent
          sx={{
            alignItems: "center",
            backgroundColor: theme.palette.background.paper,
            display: "flex",
            flexDirection: "column",
            gap: 1.5,
            justifyContent: "center",
            p: 3,
          }}
        >
          <Box
            sx={(theme) => ({
              alignItems: "center",
              background: `linear-gradient(160deg, ${alpha(theme.palette.primary.main, 0.16)} 0%, ${alpha(theme.palette.secondary.main, 0.12)} 100%)`,
              border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
              borderRadius: 3,
              display: "flex",
              height: 220,
              justifyContent: "center",
              px: 3,
              py: 2.5,
              width: 220,
            })}
          >
            <Stack alignItems="center" spacing={1.25}>
              <Inventory2RoundedIcon color="action" sx={{ fontSize: 52 }} />
              <Typography
                sx={{
                  color: theme.palette.mode === "dark" ? theme.palette.common.white : theme.palette.common.black,
                  fontSize: "1.4rem",
                  fontWeight: 800,
                  letterSpacing: "-0.03em",
                  lineHeight: 1,
                }}
              >
                {thumbnailLabel}
              </Typography>
            </Stack>
          </Box>
          <Typography sx={{ maxWidth: 260, textAlign: "center" }} variant="body2">
            {row.productName || row.merchantSku}
          </Typography>
        </DialogContent>
      </Dialog>
    </Box>
  );
}

function buildInventoryInformationColumns(locale: "en" | "zh-CN") {
  const widths =
    locale === "en"
      ? {
          productInfo: "19%",
          warehouse: "7%",
          clientInfo: "14%",
          inTransit: "6.5%",
          pendingReceival: "9.5%",
          toList: "6%",
          orderAllocated: "9.5%",
          availableStock: "8%",
          defectiveProducts: "8%",
          totalInventory: "7%",
        }
      : {
          productInfo: "20%",
          warehouse: "8%",
          clientInfo: "14.5%",
          inTransit: "6.25%",
          pendingReceival: "8.5%",
          toList: "5.75%",
          orderAllocated: "8.5%",
          availableStock: "7.5%",
          defectiveProducts: "7.5%",
          totalInventory: "6.5%",
        };

  return [
    {
      header: "Product Info",
      headerAlign: "center" as const,
      key: "productInfo",
      minWidth: locale === "en" ? 228 : 236,
      nowrap: true,
      wrapHeader: true,
      sortKey: "merchantSku",
      width: widths.productInfo,
      render: (row: InventoryInformationRow) => <InventoryProductInfoCell row={row} />,
    },
    {
      header: "Warehouse",
      headerAlign: "center" as const,
      key: "warehouse",
      minWidth: locale === "en" ? 92 : 100,
      nowrap: true,
      wrapHeader: true,
      sortKey: "warehouseName",
      width: widths.warehouse,
      render: (row: InventoryInformationRow) => renderValue(row.warehouseName),
    },
    {
      header: "Client Info",
      headerAlign: "center" as const,
      key: "clientInfo",
      minWidth: locale === "en" ? 160 : 172,
      nowrap: true,
      wrapHeader: true,
      sortKey: "client",
      width: widths.clientInfo,
      render: (row: InventoryInformationRow) => <InventoryClientInfoCell row={row} />,
    },
    {
      header: "In Transit",
      key: "inTransit",
      align: "center" as const,
      headerAlign: "center" as const,
      fitContent: true,
      nowrap: true,
      wrapHeader: true,
      sortKey: "inTransit",
      width: widths.inTransit,
      render: (row: InventoryInformationRow) => formatNumber(row.inTransit),
    },
    {
      header: "Pending Receival",
      key: "pendingReceival",
      align: "center" as const,
      headerAlign: "center" as const,
      fitContent: true,
      nowrap: true,
      wrapHeader: true,
      sortKey: "pendingReceival",
      width: widths.pendingReceival,
      render: (row: InventoryInformationRow) => formatNumber(row.pendingReceival),
    },
    {
      header: "To List",
      key: "toList",
      align: "center" as const,
      headerAlign: "center" as const,
      fitContent: true,
      nowrap: true,
      wrapHeader: true,
      sortKey: "toList",
      width: widths.toList,
      render: (row: InventoryInformationRow) => formatNumber(row.toList),
    },
    {
      header: "Order Allocated",
      key: "orderAllocated",
      align: "center" as const,
      headerAlign: "center" as const,
      fitContent: true,
      nowrap: true,
      wrapHeader: true,
      sortKey: "orderAllocated",
      width: widths.orderAllocated,
      render: (row: InventoryInformationRow) => formatNumber(row.orderAllocated),
    },
    {
      header: "Available Stock",
      key: "availableStock",
      align: "center" as const,
      headerAlign: "center" as const,
      fitContent: true,
      nowrap: true,
      wrapHeader: true,
      sortKey: "availableStock",
      width: widths.availableStock,
      render: (row: InventoryInformationRow) => formatNumber(row.availableStock),
    },
    {
      header: "Defective Products",
      key: "defectiveProducts",
      align: "center" as const,
      headerAlign: "center" as const,
      fitContent: true,
      nowrap: true,
      wrapHeader: true,
      sortKey: "defectiveProducts",
      width: widths.defectiveProducts,
      render: (row: InventoryInformationRow) => formatNumber(row.defectiveProducts),
    },
    {
      header: "Total Inventory",
      key: "totalInventory",
      align: "center" as const,
      headerAlign: "center" as const,
      fitContent: true,
      nowrap: true,
      wrapHeader: true,
      sortKey: "totalInventory",
      width: widths.totalInventory,
      render: (row: InventoryInformationRow) => formatNumber(row.totalInventory),
    },
  ];
}

function InventoryMultiSelectFilter({
  label,
  placeholder,
  value,
  options,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  options: InventoryInformationFilterOption[];
  onChange: (nextValue: string) => void;
}) {
  const selectedValues = decodeInventoryInformationMultiValue(value);
  const selectedOptions = options.filter((option) => selectedValues.includes(option.value));

  return (
    <Autocomplete
      disableCloseOnSelect
      limitTags={1}
      multiple
      onChange={(_event, nextOptions) => onChange(nextOptions.length > 0 ? encodeInventoryInformationMultiValue(nextOptions.map((option) => option.value)) : "")}
      options={options}
      getOptionLabel={(option) => option.label}
      isOptionEqualToValue={(option, selectedOption) => option.value === selectedOption.value}
      renderInput={(params) => (
        <TextField
          {...params}
          hiddenLabel
          inputProps={{
            ...params.inputProps,
            "aria-label": label,
          }}
          placeholder={selectedOptions.length === 0 ? placeholder : undefined}
          size="small"
        />
      )}
      renderOption={(props, option, { selected }) => (
        <Box component="li" {...props} sx={{ fontSize: (theme) => theme.typography.body2.fontSize }}>
          <Checkbox checked={selected} size="small" sx={{ mr: 1 }} />
          {option.label}
        </Box>
      )}
      sx={{
        flex: "0 0 auto",
        minWidth: 140,
        width: 140,
        "& .MuiAutocomplete-tag": {
          height: 20,
        },
        "& .MuiChip-label": {
          fontSize: (theme) => theme.typography.caption.fontSize,
          px: 0.75,
        },
        "& .MuiInputBase-input": {
          fontSize: (theme) => theme.typography.body2.fontSize,
          py: 0.875,
        },
        "& .MuiOutlinedInput-root": {
          minHeight: 34,
        },
      }}
      value={selectedOptions}
    />
  );
}

interface InventoryInformationToolbarProps {
  dataView: UseDataViewResult<InventoryInformationFilters>;
  actions?: ReactNode;
  warehouseOptions: InventoryInformationFilterOption[];
  tagOptions: InventoryInformationFilterOption[];
  clientOptions: InventoryInformationFilterOption[];
  skuOptions: InventoryInformationFilterOption[];
}

function InventoryInformationToolbar({
  dataView,
  actions,
  warehouseOptions,
  tagOptions,
  clientOptions,
  skuOptions,
}: InventoryInformationToolbarProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { translateText } = useI18n();

  return (
    <Stack spacing={0}>
      <Stack
        alignItems="center"
        direction="row"
        spacing={1}
        sx={{
          flexWrap: "nowrap",
          overflowX: "auto",
          pb: 0.5,
          scrollbarWidth: "thin",
        }}
      >
        <Stack alignItems="center" direction="row" spacing={1} sx={{ flex: "0 0 auto", minWidth: 0 }}>
          <TextField
            hiddenLabel
            onChange={(event) => dataView.updateFilter("query", event.target.value)}
            placeholder={translateText("Search")}
            size="small"
            value={dataView.filters.query}
            slotProps={{
              htmlInput: {
                "aria-label": translateText("Search inventory"),
                autoCapitalize: "none",
                autoCorrect: "off",
                spellCheck: false,
              },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon color="action" fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: dataView.filters.query ? (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label={translateText("Clear inventory search")}
                      edge="end"
                      onClick={() => dataView.updateFilter("query", "")}
                      size="small"
                    >
                      <CloseRoundedIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : undefined,
              },
            }}
            sx={{
              flex: "0 0 auto",
              width: 240,
              "& .MuiInputBase-input": {
                fontSize: theme.typography.body2.fontSize,
                py: 0.875,
              },
              "& .MuiOutlinedInput-root": {
                backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.48 : 0.96),
                borderRadius: 2,
                minHeight: 34,
              },
            }}
          />
        </Stack>
        <InventoryMultiSelectFilter
          label={translateText("Warehouses")}
          onChange={(nextValue) => dataView.updateFilter("warehouses", nextValue)}
          options={warehouseOptions}
          placeholder={translateText("Warehouse")}
          value={dataView.filters.warehouses}
        />
        <InventoryMultiSelectFilter
          label={translateText("Tags")}
          onChange={(nextValue) => dataView.updateFilter("tags", nextValue)}
          options={tagOptions}
          placeholder={translateText("Tags")}
          value={dataView.filters.tags}
        />
        <InventoryMultiSelectFilter
          label={translateText("Clients")}
          onChange={(nextValue) => dataView.updateFilter("clients", nextValue)}
          options={clientOptions}
          placeholder={translateText("Clients")}
          value={dataView.filters.clients}
        />
        <Stack direction="row" spacing={1} sx={{ flex: "0 0 auto" }}>
          <TextField
            hiddenLabel
            onChange={(event) => dataView.updateFilter("inventoryCountMin", event.target.value)}
            placeholder={translateText("Min")}
            size="small"
            slotProps={{ htmlInput: { "aria-label": translateText("Min inventory count"), inputMode: "numeric", min: 0 } }}
            sx={{
              width: 84,
              "& .MuiInputBase-input": {
                fontSize: theme.typography.body2.fontSize,
                py: 0.875,
              },
              "& .MuiOutlinedInput-root": {
                minHeight: 34,
              },
            }}
            type="number"
            value={dataView.filters.inventoryCountMin}
          />
          <TextField
            hiddenLabel
            onChange={(event) => dataView.updateFilter("inventoryCountMax", event.target.value)}
            placeholder={translateText("Max")}
            size="small"
            slotProps={{ htmlInput: { "aria-label": translateText("Max inventory count"), inputMode: "numeric", min: 0 } }}
            sx={{
              width: 84,
              "& .MuiInputBase-input": {
                fontSize: theme.typography.body2.fontSize,
                py: 0.875,
              },
              "& .MuiOutlinedInput-root": {
                minHeight: 34,
              },
            }}
            type="number"
            value={dataView.filters.inventoryCountMax}
          />
        </Stack>
        <InventoryMultiSelectFilter
          label={translateText("SKU")}
          onChange={(nextValue) => dataView.updateFilter("merchantSkus", nextValue)}
          options={skuOptions}
          placeholder={translateText("SKU")}
          value={dataView.filters.merchantSkus}
        />
        <Tooltip enterDelay={200} title={translateText("Clear all filters")}>
          <span>
            <IconButton
              aria-label={translateText("Clear all filters")}
              disabled={dataView.activeFilterCount === 0}
              onClick={dataView.resetFilters}
              size="small"
              sx={{
                border: `1px solid ${alpha(theme.palette.divider, 0.78)}`,
                borderRadius: 2,
                flex: "0 0 auto",
              }}
            >
              <RestartAltRoundedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        {actions ? <Box sx={{ alignItems: "center", display: "inline-flex", flex: "0 0 auto" }}>{actions}</Box> : null}
      </Stack>
    </Stack>
  );
}

interface InventoryInformationTableProps {
  rows: InventoryInformationRow[];
  total: number;
  isLoading: boolean;
  error?: string | null;
  dataView: UseDataViewResult<InventoryInformationFilters>;
  actions?: ReactNode;
  rowSelection?: ResourceTableRowSelection<InventoryInformationRow>;
  selectionBar?: ReactNode;
  warehouseOptions: InventoryInformationFilterOption[];
  tagOptions: InventoryInformationFilterOption[];
  clientOptions: InventoryInformationFilterOption[];
  skuOptions: InventoryInformationFilterOption[];
  sortKey: InventoryInformationSortKey;
  sortDirection: "asc" | "desc";
  onSortChange: (nextSortKey: InventoryInformationSortKey) => void;
}

export function InventoryInformationTable({
  rows,
  total,
  isLoading,
  error,
  dataView,
  actions,
  rowSelection,
  selectionBar,
  warehouseOptions,
  tagOptions,
  clientOptions,
  skuOptions,
  sortKey,
  sortDirection,
  onSortChange,
}: InventoryInformationTableProps) {
  const { locale } = useI18n();
  const columns = useMemo(() => buildInventoryInformationColumns(locale), [locale]);

  return (
    <ResourceTable
      allowHorizontalScroll
      compact
      columns={columns}
      emptyMessage="No inventory information matches the current filters."
      error={error}
      getRowId={(row) => row.id}
      isLoading={isLoading}
      pagination={{
        page: dataView.page,
        pageSize: dataView.pageSize,
        total,
        onPageChange: dataView.setPage,
      }}
      rowSelection={rowSelection}
      rows={rows}
      sorting={{
        direction: sortDirection,
        onSortChange: (nextSortKey) => onSortChange(nextSortKey as InventoryInformationSortKey),
        sortKey,
      }}
      tableBorderRadius={1.5}
      toolbar={
        <Stack spacing={1}>
          {selectionBar ? (
            <Box
              sx={(theme) => ({
                "& .MuiButton-root": {
                  fontSize: theme.typography.body2.fontSize,
                },
                "& .MuiChip-label": {
                  fontSize: theme.typography.caption.fontSize,
                },
                "& .MuiTypography-body2": {
                  fontSize: theme.typography.body2.fontSize,
                },
              })}
            >
              {selectionBar}
            </Box>
          ) : null}
          <InventoryInformationToolbar
            actions={actions}
            clientOptions={clientOptions}
            dataView={dataView}
            skuOptions={skuOptions}
            tagOptions={tagOptions}
            warehouseOptions={warehouseOptions}
          />
        </Stack>
      }
    />
  );
}
