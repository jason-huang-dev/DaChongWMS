import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import {
  Alert,
  Autocomplete,
  Box,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  IconButton,
  InputAdornment,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import { brandColors, brandMotion } from "@/app/brand";
import { useI18n } from "@/app/ui-preferences";
import {
  decodeInventoryInformationMultiValue,
  encodeInventoryInformationMultiValue,
} from "@/features/inventory/model/inventory-information";
import type { InventoryInformationRow, InventoryInformationSortKey } from "@/features/inventory/model/types";
import type { ResourceTableRowSelection } from "@/shared/components/resource-table";
import type { DataViewFilters, UseDataViewResult } from "@/shared/hooks/use-data-view";
import { formatDateTime, formatNumber, formatStatusLabel } from "@/shared/utils/format";

export interface InventoryInformationFilters extends DataViewFilters {
  query: string;
  warehouses: string;
  tags: string;
  clients: string;
  merchantSkus: string;
  inventoryCountMin: string;
  inventoryCountMax: string;
  hideZeroStock: string;
}

const selectionColumnWidth = 44;

export interface InventoryInformationFilterOption {
  value: string;
  label: string;
}

function renderValue(value: string) {
  return value || "--";
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

function renderProductDetail({
  copied,
  label,
  onCopy,
  separator,
  tooltipLabel,
  value,
}: {
  copied: boolean;
  label: string;
  onCopy?: (() => void) | undefined;
  separator: string;
  tooltipLabel: string;
  value: string;
}) {
  const content = (
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
          color: copied
            ? theme.palette.success.main
            : theme.palette.mode === "dark"
              ? theme.palette.common.white
              : theme.palette.common.black,
          fontSize: theme.typography.body2.fontSize,
          fontWeight: 800,
          lineHeight: 1.2,
          overflow: "hidden",
          textDecoration: onCopy ? "underline dotted transparent" : "none",
          textUnderlineOffset: "0.14em",
          textOverflow: "ellipsis",
          transition: theme.transitions.create(["color", "text-decoration-color"], {
            duration: theme.transitions.duration.shorter,
          }),
          whiteSpace: "nowrap",
          width: "100%",
        })}
        variant="body2"
      >
        {renderValue(value)}
      </Typography>
    </Box>
  );

  if (!onCopy || !value) {
    return content;
  }

  return (
    <Tooltip enterDelay={120} placement="top" title={tooltipLabel}>
      <Box
        component="button"
        onClick={onCopy}
        sx={{
          appearance: "none",
          background: "transparent",
          border: 0,
          color: "inherit",
          cursor: "copy",
          display: "block",
          m: 0,
          minWidth: 0,
          p: 0,
          textAlign: "left",
          width: "100%",
          "&:hover .inventory-product-copy-value, &:focus-visible .inventory-product-copy-value": {
            textDecorationColor: "currentColor",
          },
        }}
        type="button"
      >
        <Box
          className="inventory-product-copy-value"
          sx={{
            minWidth: 0,
            width: "100%",
          }}
        >
          {content}
        </Box>
      </Box>
    </Tooltip>
  );
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.left = "-9999px";
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function InventoryProductInfoCell({ row }: { row: InventoryInformationRow }) {
  const theme = useTheme();
  const { locale, translateText } = useI18n();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const copyResetTimeoutRef = useRef<number | null>(null);
  const primaryMerchantCode = row.merchantCode;
  const thumbnailLabel = buildProductThumbnailLabel(row);
  const detailSeparator = locale === "zh-CN" ? "：" : ":";
  const defaultCopyTooltipLabel = translateText("Click to copy");

  useEffect(() => {
    return () => {
      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current);
      }
    };
  }, []);

  const handleCopyProductField = async (fieldKey: string, fieldValue: string) => {
    await copyTextToClipboard(fieldValue);
    setCopiedField(fieldKey);
    if (copyResetTimeoutRef.current !== null) {
      window.clearTimeout(copyResetTimeoutRef.current);
    }
    copyResetTimeoutRef.current = window.setTimeout(() => {
      setCopiedField(null);
      copyResetTimeoutRef.current = null;
    }, 1500);
  };

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
        {renderProductDetail({
          copied: copiedField === "merchantCode",
          label: translateText("Code"),
          onCopy: primaryMerchantCode
            ? () => {
                void handleCopyProductField("merchantCode", primaryMerchantCode);
              }
            : undefined,
          separator: detailSeparator,
          tooltipLabel: copiedField === "merchantCode" ? translateText("Copied") : defaultCopyTooltipLabel,
          value: primaryMerchantCode,
        })}
        {renderProductDetail({
          copied: copiedField === "merchantSku",
          label: translateText("SKU"),
          onCopy: row.merchantSku
            ? () => {
                void handleCopyProductField("merchantSku", row.merchantSku);
              }
            : undefined,
          separator: detailSeparator,
          tooltipLabel: copiedField === "merchantSku" ? translateText("Copied") : defaultCopyTooltipLabel,
          value: row.merchantSku,
        })}
        {renderProductDetail({
          copied: copiedField === "productBarcode",
          label: translateText("Barcode"),
          onCopy: row.productBarcode
            ? () => {
                void handleCopyProductField("productBarcode", row.productBarcode);
              }
            : undefined,
          separator: detailSeparator,
          tooltipLabel: copiedField === "productBarcode" ? translateText("Copied") : defaultCopyTooltipLabel,
          value: row.productBarcode,
        })}
        {renderProductDetail({
          copied: copiedField === "productName",
          label: translateText("Name"),
          onCopy: row.productName || row.merchantSku
            ? () => {
                void handleCopyProductField("productName", row.productName || row.merchantSku);
              }
            : undefined,
          separator: detailSeparator,
          tooltipLabel: copiedField === "productName" ? translateText("Copied") : defaultCopyTooltipLabel,
          value: row.productName || row.merchantSku,
        })}
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

interface InventoryInformationColumnDefinition {
  key: string;
  header: string;
  align?: "left" | "right" | "center";
  minWidth?: number;
  sortKey?: InventoryInformationSortKey;
  width?: number | string;
  render: (row: InventoryInformationRow) => ReactNode;
}

function buildInventoryInformationClientLabel(row: InventoryInformationRow) {
  if (row.clients.length === 0) {
    return "--";
  }

  return row.clients.map((client) => client.label).join(", ");
}

function buildInventoryInformationStatusLabel(row: InventoryInformationRow) {
  const statuses = row.stockStatuses.filter(Boolean);
  if (statuses.length > 0) {
    return statuses.map((status) => formatStatusLabel(status)).join(", ");
  }
  return formatStatusLabel(row.stockStatus);
}

function buildInventoryInformationListedLabel(listingTime: string) {
  if (!listingTime) {
    return "--";
  }
  return listingTime.includes("T") ? formatDateTime(listingTime) : listingTime;
}

function InventoryInformationNumericCell({ value }: { value: number }) {
  return (
    <Typography sx={{ fontWeight: 700 }} variant="body2">
      {formatNumber(value)}
    </Typography>
  );
}

function InventoryInformationShelfCell({ row }: { row: InventoryInformationRow }) {
  const primaryShelf = row.shelf || row.shelves[0] || "--";
  const secondaryShelves = row.shelves.filter((shelf) => shelf && shelf !== primaryShelf);

  return (
    <Stack spacing={0.3} sx={{ minWidth: 0 }}>
      <Typography sx={{ fontWeight: 700, overflowWrap: "anywhere" }} variant="body2">
        {primaryShelf}
      </Typography>
      {secondaryShelves.length > 0 ? (
        <Typography color="text.secondary" sx={{ overflowWrap: "anywhere" }} variant="caption">
          {secondaryShelves.join(", ")}
        </Typography>
      ) : null}
    </Stack>
  );
}

function InventoryInformationMetaField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const { translateText } = useI18n();

  return (
    <Typography sx={{ lineHeight: 1.35 }} variant="body2">
      <Box component="span" sx={{ color: "text.secondary", fontWeight: 700 }}>
        {translateText(label)}:
      </Box>{" "}
      <Box component="span" sx={{ color: "text.secondary", fontWeight: 600 }}>
        {value || "--"}
      </Box>
    </Typography>
  );
}

function buildInventoryInformationColumns(): InventoryInformationColumnDefinition[] {
  return [
    {
      header: "Product Info",
      key: "productInfo",
      minWidth: 260,
      sortKey: "merchantSku",
      width: "24%",
      render: (row) => <InventoryProductInfoCell row={row} />,
    },
    {
      header: "Shelf",
      key: "shelf",
      minWidth: 116,
      width: "12%",
      render: (row) => <InventoryInformationShelfCell row={row} />,
    },
    {
      align: "center",
      header: "In Transit",
      key: "inTransit",
      minWidth: 86,
      sortKey: "inTransit",
      width: "7%",
      render: (row) => <InventoryInformationNumericCell value={row.inTransit} />,
    },
    {
      align: "center",
      header: "Pending Receival",
      key: "pendingReceival",
      minWidth: 108,
      sortKey: "pendingReceival",
      width: "9%",
      render: (row) => <InventoryInformationNumericCell value={row.pendingReceival} />,
    },
    {
      align: "center",
      header: "To List",
      key: "toList",
      minWidth: 84,
      sortKey: "toList",
      width: "7%",
      render: (row) => <InventoryInformationNumericCell value={row.toList} />,
    },
    {
      align: "center",
      header: "Order Allocated",
      key: "orderAllocated",
      minWidth: 110,
      sortKey: "orderAllocated",
      width: "11%",
      render: (row) => <InventoryInformationNumericCell value={row.orderAllocated} />,
    },
    {
      align: "center",
      header: "Available Stock",
      key: "availableStock",
      minWidth: 108,
      sortKey: "availableStock",
      width: "10%",
      render: (row) => <InventoryInformationNumericCell value={row.availableStock} />,
    },
    {
      align: "center",
      header: "Defective Products",
      key: "defectiveProducts",
      minWidth: 118,
      sortKey: "defectiveProducts",
      width: "10%",
      render: (row) => <InventoryInformationNumericCell value={row.defectiveProducts} />,
    },
    {
      align: "center",
      header: "Total Inventory",
      key: "totalInventory",
      minWidth: 110,
      sortKey: "totalInventory",
      width: "10%",
      render: (row) => <InventoryInformationNumericCell value={row.totalInventory} />,
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
      renderTags={(tagValue, getTagProps) => {
        const primaryTag = tagValue[0];

        if (!primaryTag) {
          return null;
        }

        return (
          <Box
            sx={{
              alignItems: "center",
              display: "flex",
              gap: 0.5,
              maxWidth: "100%",
              minWidth: 0,
              overflow: "hidden",
            }}
          >
            <Chip
              {...getTagProps({ index: 0 })}
              label={primaryTag.label}
              size="small"
              sx={{
                maxWidth: tagValue.length > 1 ? "calc(100% - 24px)" : "100%",
                minWidth: 0,
                "& .MuiChip-label": {
                  overflow: "hidden",
                  px: 0.75,
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                },
              }}
            />
            {tagValue.length > 1 ? (
              <Box
                component="span"
                sx={{
                  color: "text.secondary",
                  flex: "0 0 auto",
                  fontSize: (theme) => theme.typography.caption.fontSize,
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                }}
              >
                +{tagValue.length - 1}
              </Box>
            ) : null}
          </Box>
        );
      }}
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
        flex: "1 1 0",
        minWidth: 148,
        width: "auto",
        overflow: "hidden",
        "& .MuiAutocomplete-tag": {
          height: 20,
          maxWidth: "100%",
        },
        "& .MuiChip-label": {
          fontSize: (theme) => theme.typography.caption.fontSize,
          px: 0.75,
        },
        "& .MuiAutocomplete-input": {
          minWidth: "0 !important",
        },
        "& .MuiAutocomplete-inputRoot": {
          flexWrap: "nowrap",
          minWidth: 0,
          overflow: "hidden",
        },
        "& .MuiInputBase-input": {
          fontSize: (theme) => theme.typography.body2.fontSize,
          minWidth: 0,
          py: 0.875,
        },
        "& .MuiOutlinedInput-root": {
          minHeight: 34,
          overflow: "hidden",
        },
      }}
      value={selectedOptions}
    />
  );
}

interface InventoryInformationToolbarProps {
  dataView: UseDataViewResult<InventoryInformationFilters>;
  warehouseOptions: InventoryInformationFilterOption[];
  tagOptions: InventoryInformationFilterOption[];
  clientOptions: InventoryInformationFilterOption[];
  skuOptions: InventoryInformationFilterOption[];
}

function InventoryInformationToolbar({
  dataView,
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
          minWidth: 0,
          overflow: "hidden",
          pb: 0.5,
        }}
      >
        <Stack
          alignItems="center"
          direction="row"
          spacing={1}
          sx={{
            flex: "1 1 auto",
            minWidth: 0,
            overflow: "hidden",
          }}
        >
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
              flex: "0 1 240px",
              minWidth: 0,
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
          <Stack direction="row" spacing={1} sx={{ flex: "0 0 auto", minWidth: 0 }}>
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
        </Stack>
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
  hideZeroStock: boolean;
  onHideZeroStockChange: (checked: boolean) => void;
  rowSelection?: ResourceTableRowSelection<InventoryInformationRow>;
  selectedCount: number;
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
  hideZeroStock,
  onHideZeroStockChange,
  rowSelection,
  selectedCount,
  selectionBar,
  warehouseOptions,
  tagOptions,
  clientOptions,
  skuOptions,
  sortKey,
  sortDirection,
  onSortChange,
}: InventoryInformationTableProps) {
  const theme = useTheme();
  const { t, translateText } = useI18n();
  const isDark = theme.palette.mode === "dark";
  const columns = useMemo(() => buildInventoryInformationColumns(), []);
  const selectableRows = rowSelection
    ? rows.filter((row) => (rowSelection.isRowSelectable ? rowSelection.isRowSelectable(row) : true))
    : [];
  const selectableIds = selectableRows.map((row) => row.id);
  const selectedSelectableCount = selectableIds.filter((id) => rowSelection?.selectedRowIds.includes(id)).length;
  const allSelected = selectableIds.length > 0 && selectedSelectableCount === selectableIds.length;
  const partiallySelected = selectedSelectableCount > 0 && !allSelected;

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Stack spacing={1}>
            <InventoryInformationToolbar
              clientOptions={clientOptions}
              dataView={dataView}
              skuOptions={skuOptions}
              tagOptions={tagOptions}
              warehouseOptions={warehouseOptions}
            />
            <Stack
              alignItems={{ xs: "stretch", md: "flex-start" }}
              direction={{ xs: "column", md: "row" }}
              justifyContent="space-between"
              spacing={1}
              sx={{ minWidth: 0 }}
            >
              <Stack
                alignItems={{ xs: "stretch", md: "center" }}
                direction={{ xs: "column", md: "row" }}
                spacing={1}
                sx={{
                  flex: "1 1 auto",
                  minWidth: 0,
                }}
              >
                <Chip
                  color={selectedCount > 0 ? "primary" : "default"}
                  label={t("bulk.selectedCount", { count: selectedCount })}
                  size="small"
                  sx={{ alignSelf: { xs: "flex-start", md: "center" }, flex: "0 0 auto" }}
                />
                <Box
                  component="label"
                  sx={(theme) => ({
                    alignItems: "center",
                    alignSelf: { xs: "flex-start", md: "center" },
                    backgroundColor: alpha(theme.palette.background.paper, theme.palette.mode === "dark" ? 0.48 : 0.92),
                    border: `1px solid ${alpha(theme.palette.divider, 0.82)}`,
                    borderRadius: 999,
                    cursor: "pointer",
                    display: "inline-flex",
                    flex: "0 0 auto",
                    gap: 0.25,
                    pl: 0.5,
                    pr: 1.1,
                    py: 0.15,
                  })}
                >
                  <Checkbox
                    checked={hideZeroStock}
                    onChange={(event) => onHideZeroStockChange(event.target.checked)}
                    size="small"
                    sx={{ p: 0.5 }}
                  />
                  <Typography sx={{ fontWeight: 600, whiteSpace: "nowrap" }} variant="body2">
                    {translateText("In stock only")}
                  </Typography>
                </Box>
                <Box
                  sx={(theme) => ({
                    flex: "1 1 auto",
                    minWidth: 0,
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
              </Stack>
              <Stack
                alignItems="center"
                direction="row"
                justifyContent={{ xs: "flex-start", md: "flex-end" }}
                spacing={1}
                sx={{ flex: "0 0 auto", minWidth: 0 }}
              >
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
          </Stack>

          {error ? <Alert severity="error">{error}</Alert> : null}

          <TableContainer
            sx={{
              border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
              borderRadius: 1.5,
              overflowX: "auto",
              overflowY: "hidden",
            }}
          >
            <Table size="small" sx={{ tableLayout: "fixed", width: "100%" }}>
              <colgroup>
                {rowSelection ? <col style={{ width: selectionColumnWidth }} /> : null}
                {columns.map((column) => (
                  <col key={column.key} style={column.width ? { width: column.width } : undefined} />
                ))}
              </colgroup>
              <TableHead>
                <TableRow
                  sx={{
                    backgroundColor: alpha(theme.palette.text.primary, isDark ? 0.05 : 0.03),
                  }}
                >
                  {rowSelection ? (
                    <TableCell
                      padding="none"
                      sx={{
                        borderBottomColor: alpha(theme.palette.divider, 0.8),
                        boxSizing: "border-box",
                        maxWidth: selectionColumnWidth,
                        minWidth: selectionColumnWidth,
                        px: 0.5,
                        textAlign: "center",
                        verticalAlign: "middle",
                        width: selectionColumnWidth,
                      }}
                    >
                      <Checkbox
                        checked={allSelected}
                        disabled={selectableRows.length === 0}
                        indeterminate={partiallySelected}
                        onChange={() => rowSelection.onToggleAll(selectableRows)}
                        size="small"
                        sx={{ display: "block", mx: "auto", p: 0.5 }}
                      />
                    </TableCell>
                  ) : null}
                  {columns.map((column) => (
                    <TableCell
                      align={column.align}
                      key={column.key}
                      sx={{
                        borderBottomColor: alpha(theme.palette.divider, 0.8),
                        color: theme.palette.text.primary,
                        fontSize: theme.typography.body2.fontSize,
                        fontWeight: 800,
                        lineHeight: 1.3,
                        minWidth: column.minWidth,
                        px: 1.25,
                        py: 1.2,
                        textAlign: column.align,
                        whiteSpace: "normal",
                        width: column.width,
                      }}
                    >
                      {column.sortKey ? (
                        <TableSortLabel
                          active={sortKey === column.sortKey}
                          direction={sortKey === column.sortKey ? sortDirection : "asc"}
                          hideSortIcon={sortKey !== column.sortKey}
                          onClick={() => onSortChange(column.sortKey!)}
                          sx={{
                            display: "inline-flex",
                            fontSize: "inherit",
                            justifyContent:
                              column.align === "right"
                                ? "flex-end"
                                : column.align === "center"
                                  ? "center"
                                  : "flex-start",
                            lineHeight: 1.3,
                            textAlign: column.align,
                            width: "100%",
                          }}
                        >
                          {translateText(column.header)}
                        </TableSortLabel>
                      ) : (
                        translateText(column.header)
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={columns.length + (rowSelection ? 1 : 0)}>
                      <Stack alignItems="center" direction="row" justifyContent="center" spacing={1.5} sx={{ py: 4 }}>
                        <CircularProgress size={20} />
                        <Typography variant="body2">{translateText("Loading data...")}</Typography>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length + (rowSelection ? 1 : 0)}>
                      <Typography color="text.secondary" sx={{ py: 3 }} textAlign="center" variant="body2">
                        {translateText("No inventory information matches the current filters.")}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => {
                    const rowId = row.id;
                    const isSelected = rowSelection ? rowSelection.selectedRowIds.includes(rowId) : false;
                    const canSelect = rowSelection ? (rowSelection.isRowSelectable ? rowSelection.isRowSelectable(row) : true) : false;
                    const metaBackground = isSelected
                      ? alpha(brandColors.accent, isDark ? 0.12 : 0.08)
                      : alpha(theme.palette.text.primary, isDark ? 0.06 : 0.04);
                    const detailBackground = isSelected
                      ? alpha(brandColors.accent, isDark ? 0.06 : 0.035)
                      : alpha(theme.palette.background.paper, isDark ? 0.94 : 0.99);
                    const hoverBackground = isSelected
                      ? alpha(brandColors.accent, isDark ? 0.1 : 0.06)
                      : alpha(theme.palette.text.primary, isDark ? 0.04 : 0.025);

                    return (
                      <Fragment key={rowId}>
                        <TableRow
                          sx={{
                            "& td": {
                              backgroundColor: metaBackground,
                              borderBottomColor: "transparent",
                            },
                            opacity: rowSelection && !canSelect ? 0.68 : 1,
                          }}
                        >
                          {rowSelection ? (
                            <TableCell
                              padding="none"
                              sx={{
                                boxShadow: isSelected ? `inset 3px 0 0 ${brandColors.accent}` : "none",
                                maxWidth: selectionColumnWidth,
                                minWidth: selectionColumnWidth,
                                px: 0.5,
                                textAlign: "center",
                                verticalAlign: "middle",
                                width: selectionColumnWidth,
                              }}
                            >
                              <Checkbox
                                checked={isSelected}
                                disabled={!canSelect}
                                onChange={() => rowSelection.onToggleRow(row)}
                                size="small"
                                sx={{ display: "block", mx: "auto", p: 0.5 }}
                              />
                            </TableCell>
                          ) : null}
                          <TableCell colSpan={columns.length} sx={{ px: 1.75, py: 1.1 }}>
                            <Stack
                              alignItems={{ md: "center", xs: "flex-start" }}
                              direction={{ md: "row", xs: "column" }}
                              justifyContent="space-between"
                              spacing={1}
                            >
                              <Stack direction="row" flexWrap="wrap" spacing={3} useFlexGap>
                                <InventoryInformationMetaField label="Warehouse" value={row.warehouseName || "--"} />
                                <InventoryInformationMetaField label="Client" value={buildInventoryInformationClientLabel(row)} />
                                <InventoryInformationMetaField label="Area" value={row.areaLabel || "--"} />
                                <InventoryInformationMetaField label="Status" value={buildInventoryInformationStatusLabel(row)} />
                              </Stack>
                              <InventoryInformationMetaField label="Listed" value={buildInventoryInformationListedLabel(row.listingTime)} />
                            </Stack>
                          </TableCell>
                        </TableRow>
                        <TableRow
                          hover
                          sx={{
                            "& td": {
                              backgroundColor: detailBackground,
                              borderBottomColor: alpha(theme.palette.divider, 0.62),
                              fontSize: theme.typography.body2.fontSize,
                              lineHeight: theme.typography.body2.lineHeight,
                              py: 1.6,
                              transition: [
                                `background-color ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                                `box-shadow ${brandMotion.duration.standard} ${brandMotion.easing.standard}`,
                              ].join(", "),
                              verticalAlign: "top",
                            },
                            "&:hover td": {
                              backgroundColor: hoverBackground,
                            },
                            opacity: rowSelection && !canSelect ? 0.68 : 1,
                          }}
                        >
                          {rowSelection ? (
                            <TableCell
                              sx={{
                                backgroundColor: detailBackground,
                                borderBottomColor: alpha(theme.palette.divider, 0.62),
                                maxWidth: selectionColumnWidth,
                                minWidth: selectionColumnWidth,
                                px: 0,
                                width: selectionColumnWidth,
                              }}
                            />
                          ) : null}
                          {columns.map((column) => (
                            <TableCell
                              align={column.align}
                              key={column.key}
                              sx={{
                                minWidth: column.minWidth,
                                px: 1.25,
                                textAlign: column.align,
                                width: column.width,
                              }}
                            >
                              {column.render(row)}
                            </TableCell>
                          ))}
                        </TableRow>
                      </Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            component="div"
            count={total}
            onPageChange={(_event, nextPage) => dataView.setPage(nextPage + 1)}
            onRowsPerPageChange={() => undefined}
            page={Math.max(dataView.page - 1, 0)}
            rowsPerPage={dataView.pageSize}
            rowsPerPageOptions={[dataView.pageSize]}
          />
        </Stack>
      </CardContent>
    </Card>
  );
}
