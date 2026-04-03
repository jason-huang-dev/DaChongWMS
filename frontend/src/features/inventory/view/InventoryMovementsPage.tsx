import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  MenuItem,
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
import { alpha, useTheme, type SxProps, type Theme } from "@mui/material/styles";

import { brandColors, brandMotion } from "@/app/brand";
import { useTenantScope } from "@/app/scope-context";
import { useI18n } from "@/app/ui-preferences";
import { inventoryApi } from "@/features/inventory/model/api";
import {
  decodeInventoryInformationMultiValue,
  encodeInventoryInformationMultiValue,
} from "@/features/inventory/model/inventory-information";
import type {
  InventoryMovementHistoryDocumentNumber,
  InventoryMovementHistoryFilterOption,
  InventoryMovementHistoryListResponse,
  InventoryMovementHistoryRow,
  InventoryMovementHistorySortKey,
} from "@/features/inventory/model/types";
import { useDataView, type DataViewFilters } from "@/shared/hooks/use-data-view";
import { formatDateTime, formatNumber, formatStatusLabel } from "@/shared/utils/format";
import { parseApiError } from "@/shared/utils/parse-api-error";
import { apiGet } from "@/lib/http";

const movementHistoryPageSize = 15;
const selectionColumnWidth = 44;
const increaseMovementTypes = new Set(["OPENING", "RECEIPT", "PUTAWAY", "TRANSFER", "ADJUSTMENT_IN", "RELEASE_HOLD"]);
const decreaseMovementTypes = new Set(["PICK", "SHIP", "ADJUSTMENT_OUT", "HOLD"]);

interface InventoryMovementFilters extends DataViewFilters {
  query: string;
  warehouses: string;
  movementTypes: string;
  dateFrom: string;
  dateTo: string;
  quantityMin: string;
  quantityMax: string;
  merchantSku: string;
  locationCode: string;
  performedBy: string;
  referenceCode: string;
  matchMode: string;
}

interface InventoryMovementColumnDefinition {
  key: string;
  header: string;
  align?: "left" | "right" | "center";
  minWidth?: number;
  sortKey?: InventoryMovementHistorySortKey;
  width?: number | string;
  render: (row: InventoryMovementHistoryRow) => ReactNode;
}

function buildMovementHistoryQueryParams({
  page,
  pageSize,
  warehouseId,
  filters,
  sorting,
}: {
  page: number;
  pageSize: number;
  warehouseId: number | null;
  filters: Record<string, string>;
  sorting: { key: InventoryMovementHistorySortKey; direction: "asc" | "desc" };
}) {
  return {
    page,
    page_size: pageSize,
    warehouse_id: warehouseId ?? undefined,
    sortKey: sorting.key,
    sortDirection: sorting.direction,
    ...filters,
  };
}

function InventoryMovementMultiSelectFilter({
  label,
  placeholder,
  value,
  options,
  onChange,
  sx,
}: {
  label: string;
  placeholder: string;
  value: string;
  options: InventoryMovementHistoryFilterOption[];
  onChange: (nextValue: string) => void;
  sx?: SxProps<Theme>;
}) {
  const selectedValues = decodeInventoryInformationMultiValue(value);
  const selectedOptions = options.filter((option) => selectedValues.includes(option.value));

  return (
    <Autocomplete
      disableCloseOnSelect
      limitTags={1}
      multiple
      onChange={(_event, nextOptions) =>
        onChange(
          nextOptions.length > 0
            ? encodeInventoryInformationMultiValue(nextOptions.map((option) => option.value))
            : "",
        )
      }
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
      sx={[
        {
          flex: "1 1 0",
          minWidth: 168,
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
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
      value={selectedOptions}
    />
  );
}

function InventoryMovementProductCell({ row }: { row: InventoryMovementHistoryRow }) {
  return (
    <Stack spacing={0.4} sx={{ minWidth: 0 }}>
      <Typography sx={{ fontWeight: 800 }} variant="body2">
        {row.merchantSku || "--"}
      </Typography>
      <Typography sx={{ fontWeight: 600 }} variant="body2">
        {row.productBarcode || "--"}
      </Typography>
      <Typography color="text.secondary" sx={{ overflow: "hidden", textOverflow: "ellipsis" }} variant="body2">
        {row.productName || "--"}
      </Typography>
    </Stack>
  );
}

function InventoryMovementDocumentCell({
  entries,
  fallback = "--",
}: {
  entries: InventoryMovementHistoryDocumentNumber[];
  fallback?: string;
}) {
  const { translateText } = useI18n();

  return (
    <Stack spacing={0.6} sx={{ minWidth: 0 }}>
      {entries.length > 0 ? (
        entries.map((entry) => (
          <Typography
            key={`${entry.label}-${entry.value}`}
            sx={{ lineHeight: 1.4, overflowWrap: "anywhere" }}
            variant="body2"
          >
            <Box component="span" sx={{ color: "text.secondary", fontWeight: 600 }}>
              {translateText(entry.label)}:
            </Box>{" "}
            <Box component="span" sx={{ fontWeight: 700 }}>
              {entry.value}
            </Box>
          </Typography>
        ))
      ) : (
        <Typography color="text.secondary" variant="body2">
          {fallback}
        </Typography>
      )}
    </Stack>
  );
}

function InventoryMovementSourceDocumentCell({ row }: { row: InventoryMovementHistoryRow }) {
  const primaryValue = row.sourceDocumentNumber || row.purchaseOrderNumber || row.referenceCode || "--";
  const secondaryEntries = row.sourceDocumentNumbers.filter((entry) => entry.value && entry.value !== primaryValue);
  const { translateText } = useI18n();

  return (
    <Stack spacing={0.5} sx={{ minWidth: 0 }}>
      <Typography sx={{ fontWeight: 700, overflowWrap: "anywhere" }} variant="body2">
        {primaryValue}
      </Typography>
      {secondaryEntries.map((entry) => (
        <Typography
          color="text.secondary"
          key={`${entry.label}-${entry.value}`}
          sx={{ lineHeight: 1.35, overflowWrap: "anywhere" }}
          variant="caption"
        >
          {translateText(entry.label)}: {entry.value}
        </Typography>
      ))}
    </Stack>
  );
}

function InventoryMovementTextCell({
  primary,
  secondary,
}: {
  primary: string;
  secondary?: string;
}) {
  return (
    <Stack spacing={0.3} sx={{ minWidth: 0 }}>
      <Typography sx={{ fontWeight: 700, overflowWrap: "anywhere" }} variant="body2">
        {primary || "--"}
      </Typography>
      {secondary ? (
        <Typography color="text.secondary" sx={{ overflowWrap: "anywhere" }} variant="caption">
          {secondary}
        </Typography>
      ) : null}
    </Stack>
  );
}

function InventoryMovementQuantityCell({ row }: { row: InventoryMovementHistoryRow }) {
  return (
    <Typography
      sx={(theme) => ({
        color: increaseMovementTypes.has(row.movementType)
          ? theme.palette.success.main
          : decreaseMovementTypes.has(row.movementType)
            ? theme.palette.error.main
            : theme.palette.text.primary,
        fontWeight: 800,
      })}
      variant="body2"
    >
      {formatNumber(row.quantity)}
    </Typography>
  );
}

function InventoryMovementNumericCell({ value }: { value: number | null }) {
  return (
    <Typography sx={{ fontWeight: 700 }} variant="body2">
      {formatNumber(value)}
    </Typography>
  );
}

function InventoryMovementMetaField({
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

export function InventoryMovementsPage() {
  const theme = useTheme();
  const { t, translateText } = useI18n();
  const { company, activeWarehouseId } = useTenantScope();
  const companyId = company?.id !== undefined && company?.id !== null ? Number(company.id) : null;
  const [sorting, setSorting] = useState<{ key: InventoryMovementHistorySortKey; direction: "asc" | "desc" }>({
    key: "occurredAt",
    direction: "desc",
  });
  const [selectedRowIds, setSelectedRowIds] = useState<number[]>([]);
  const movementView = useDataView<InventoryMovementFilters>({
    viewKey: `inventory-movements.${company?.openid ?? "anonymous"}`,
    defaultFilters: {
      query: "",
      warehouses: "",
      movementTypes: "",
      dateFrom: "",
      dateTo: "",
      quantityMin: "",
      quantityMax: "",
      merchantSku: "",
      locationCode: "",
      performedBy: "",
      referenceCode: "",
      matchMode: "",
    },
    pageSize: movementHistoryPageSize,
  });

  const movementHistoryQuery = useQuery({
    queryKey: [
      "inventory",
      "movements",
      companyId,
      activeWarehouseId ?? "all",
      movementView.page,
      movementView.pageSize,
      movementView.queryFilters,
      sorting,
    ],
    queryFn: () =>
      apiGet<InventoryMovementHistoryListResponse>(
        inventoryApi.movementHistory(companyId ?? "0"),
        buildMovementHistoryQueryParams({
          page: movementView.page,
          pageSize: movementView.pageSize,
          warehouseId: activeWarehouseId,
          filters: movementView.queryFilters,
          sorting,
        }),
      ),
    enabled: Boolean(companyId),
    placeholderData: keepPreviousData,
  });

  const rows = movementHistoryQuery.data?.results ?? [];
  const filterOptions = movementHistoryQuery.data?.filterOptions;
  const isDark = theme.palette.mode === "dark";
  const matchModeValue = movementView.filters.matchMode || "contains";
  const columns = useMemo<InventoryMovementColumnDefinition[]>(
    () => [
      {
        header: "Product Info",
        key: "productInfo",
        minWidth: 190,
        sortKey: "merchantSku",
        width: "18%",
        render: (row) => <InventoryMovementProductCell row={row} />,
      },
      {
        header: "Linked Document Number",
        key: "linkedDocuments",
        minWidth: 260,
        width: "22%",
        render: (row) => <InventoryMovementDocumentCell entries={row.linkedDocumentNumbers} />,
      },
      {
        header: "Source Document Number",
        key: "sourceDocumentNumber",
        minWidth: 170,
        width: "14%",
        render: (row) => <InventoryMovementSourceDocumentCell row={row} />,
      },
      {
        header: "Batch No",
        key: "batchNumber",
        minWidth: 130,
        width: "11%",
        render: (row) => (
          <InventoryMovementTextCell
            primary={row.batchNumber || "--"}
            secondary={row.serialNumber && row.serialNumber !== row.batchNumber ? row.serialNumber : undefined}
          />
        ),
      },
      {
        header: "Shelf",
        key: "shelf",
        minWidth: 88,
        width: "7%",
        render: (row) => row.shelfCode || row.toLocationCode || row.fromLocationCode || "--",
      },
      {
        align: "right",
        header: "Original inventory of shelf",
        key: "quantityBeforeChange",
        minWidth: 132,
        width: "10%",
        render: (row) => <InventoryMovementNumericCell value={row.quantityBeforeChange} />,
      },
      {
        align: "right",
        header: "Number of Changes",
        key: "quantity",
        minWidth: 124,
        sortKey: "quantity",
        width: "10%",
        render: (row) => <InventoryMovementQuantityCell row={row} />,
      },
      {
        align: "right",
        header: "Remaining Qty of Batch",
        key: "remainingBatchQuantity",
        minWidth: 132,
        width: "10%",
        render: (row) => <InventoryMovementNumericCell value={row.remainingBatchQuantity} />,
      },
      {
        align: "right",
        header: "Total inventory after change",
        key: "resultingQuantity",
        minWidth: 144,
        sortKey: "resultingQuantity",
        width: "12%",
        render: (row) => <InventoryMovementNumericCell value={row.resultingQuantity} />,
      },
    ],
    [],
  );

  useEffect(() => {
    const currentRowIds = new Set(rows.map((row) => row.id));
    setSelectedRowIds((currentSelectedRowIds) => {
      const nextSelectedRowIds = currentSelectedRowIds.filter((rowId) => currentRowIds.has(rowId));
      return nextSelectedRowIds.length === currentSelectedRowIds.length ? currentSelectedRowIds : nextSelectedRowIds;
    });
  }, [rows]);

  const selectableRowIds = rows.map((row) => row.id);
  const selectedVisibleCount = selectableRowIds.filter((rowId) => selectedRowIds.includes(rowId)).length;
  const allSelected = selectableRowIds.length > 0 && selectedVisibleCount === selectableRowIds.length;
  const partiallySelected = selectedVisibleCount > 0 && !allSelected;

  return (
    <Stack spacing={2.5}>
      <Card>
        <CardContent>
          <Stack spacing={1}>
            <Stack
              alignItems="center"
              direction="row"
              spacing={1}
              sx={{
                flexWrap: "nowrap",
                minWidth: 0,
                overflow: "hidden",
              }}
            >
              <InventoryMovementMultiSelectFilter
                label={translateText("Warehouses")}
                onChange={(nextValue) => movementView.updateFilter("warehouses", nextValue)}
                options={filterOptions?.warehouses ?? []}
                placeholder={translateText("Warehouses")}
                value={movementView.filters.warehouses}
              />
              <InventoryMovementMultiSelectFilter
                label={translateText("Movement Types")}
                onChange={(nextValue) => movementView.updateFilter("movementTypes", nextValue)}
                options={filterOptions?.movementTypes ?? []}
                placeholder={translateText("Movement Types")}
                value={movementView.filters.movementTypes}
              />
              <TextField
                hiddenLabel
                onChange={(event) => movementView.updateFilter("dateFrom", event.target.value)}
                size="small"
                slotProps={{ htmlInput: { "aria-label": translateText("From date") } }}
                sx={{
                  flex: "0 1 168px",
                  minWidth: 140,
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
                type="date"
                value={movementView.filters.dateFrom}
              />
              <TextField
                hiddenLabel
                onChange={(event) => movementView.updateFilter("dateTo", event.target.value)}
                size="small"
                slotProps={{ htmlInput: { "aria-label": translateText("To date") } }}
                sx={{
                  flex: "0 1 168px",
                  minWidth: 140,
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
                type="date"
                value={movementView.filters.dateTo}
              />
            </Stack>
            <Stack
              alignItems="center"
              direction="row"
              spacing={1}
              sx={{ minWidth: 0 }}
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
                  onChange={(event) => movementView.updateFilter("merchantSku", event.target.value)}
                  placeholder={translateText("Merchant SKU")}
                  size="small"
                  slotProps={{
                    htmlInput: {
                      "aria-label": translateText("Merchant SKU"),
                      autoCapitalize: "none",
                      autoCorrect: "off",
                      spellCheck: false,
                    },
                  }}
                  sx={{
                    flex: "1 1 0",
                    minWidth: 140,
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
                  value={movementView.filters.merchantSku}
                />
                <TextField
                  hiddenLabel
                  onChange={(event) => movementView.updateFilter("locationCode", event.target.value)}
                  placeholder={translateText("Location")}
                  size="small"
                  slotProps={{
                    htmlInput: {
                      "aria-label": translateText("Location"),
                      autoCapitalize: "none",
                      autoCorrect: "off",
                      spellCheck: false,
                    },
                  }}
                  sx={{
                    flex: "1 1 0",
                    minWidth: 140,
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
                  value={movementView.filters.locationCode}
                />
                <TextField
                  hiddenLabel
                  onChange={(event) => movementView.updateFilter("performedBy", event.target.value)}
                  placeholder={translateText("Performed By")}
                  size="small"
                  slotProps={{
                    htmlInput: {
                      "aria-label": translateText("Performed By"),
                      autoCapitalize: "none",
                      autoCorrect: "off",
                      spellCheck: false,
                    },
                  }}
                  sx={{
                    flex: "1 1 0",
                    minWidth: 140,
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
                  value={movementView.filters.performedBy}
                />
                <TextField
                  hiddenLabel
                  onChange={(event) => movementView.updateFilter("referenceCode", event.target.value)}
                  placeholder={translateText("Reference")}
                  size="small"
                  slotProps={{
                    htmlInput: {
                      "aria-label": translateText("Reference"),
                      autoCapitalize: "none",
                      autoCorrect: "off",
                      spellCheck: false,
                    },
                  }}
                  sx={{
                    flex: "1 1 0",
                    minWidth: 140,
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
                  value={movementView.filters.referenceCode}
                />
              </Stack>
            </Stack>
            <Stack
              alignItems="center"
              direction="row"
              justifyContent="space-between"
              spacing={1}
              sx={{ minWidth: 0 }}
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
                  onChange={(event) => movementView.updateFilter("query", event.target.value)}
                  placeholder={translateText("Search all text")}
                  size="small"
                  slotProps={{
                    htmlInput: {
                      "aria-label": translateText("Search all text"),
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
                    },
                  }}
                  sx={{
                    flex: "1 1 auto",
                    minWidth: 180,
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
                  value={movementView.filters.query}
                />
                <TextField
                  hiddenLabel
                  onChange={(event) =>
                    movementView.updateFilter("matchMode", event.target.value === "contains" ? "" : event.target.value)
                  }
                  select
                  size="small"
                  slotProps={{ select: { "aria-label": translateText("Match mode") } }}
                  sx={{
                    flex: "0 0 140px",
                    "& .MuiInputBase-input": {
                      fontSize: theme.typography.body2.fontSize,
                      py: 0.875,
                    },
                    "& .MuiOutlinedInput-root": {
                      minHeight: 34,
                    },
                  }}
                  value={matchModeValue}
                >
                  <MenuItem value="contains">{translateText("Contains")}</MenuItem>
                  <MenuItem value="exact">{translateText("Exact")}</MenuItem>
                </TextField>
                <TextField
                  hiddenLabel
                  onChange={(event) => movementView.updateFilter("quantityMin", event.target.value)}
                  placeholder={translateText("Min Qty")}
                  size="small"
                  slotProps={{ htmlInput: { "aria-label": translateText("Minimum quantity"), inputMode: "numeric" } }}
                  sx={{
                    flex: "0 0 110px",
                    "& .MuiInputBase-input": {
                      fontSize: theme.typography.body2.fontSize,
                      py: 0.875,
                    },
                    "& .MuiOutlinedInput-root": {
                      minHeight: 34,
                    },
                  }}
                  type="number"
                  value={movementView.filters.quantityMin}
                />
                <TextField
                  hiddenLabel
                  onChange={(event) => movementView.updateFilter("quantityMax", event.target.value)}
                  placeholder={translateText("Max Qty")}
                  size="small"
                  slotProps={{ htmlInput: { "aria-label": translateText("Maximum quantity"), inputMode: "numeric" } }}
                  sx={{
                    flex: "0 0 110px",
                    "& .MuiInputBase-input": {
                      fontSize: theme.typography.body2.fontSize,
                      py: 0.875,
                    },
                    "& .MuiOutlinedInput-root": {
                      minHeight: 34,
                    },
                  }}
                  type="number"
                  value={movementView.filters.quantityMax}
                />
              </Stack>
              <Tooltip enterDelay={200} title={translateText("Clear all filters")}>
                <span>
                  <IconButton
                    aria-label={translateText("Clear all filters")}
                    disabled={movementView.activeFilterCount === 0}
                    onClick={movementView.resetFilters}
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
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ pb: 1.5 }}>
          <Stack spacing={2}>
            {movementHistoryQuery.error ? <Alert severity="error">{parseApiError(movementHistoryQuery.error)}</Alert> : null}

            <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={2}>
              <Stack alignItems="center" direction="row" spacing={1.25}>
                <Typography color="text.secondary" variant="body2">
                  {t("bulk.selectedCount", { count: selectedVisibleCount })}
                </Typography>
                {selectedVisibleCount > 0 ? (
                  <Button onClick={() => setSelectedRowIds([])} size="small" sx={{ minWidth: 0, px: 1.25 }}>
                    {translateText("Clear selection")}
                  </Button>
                ) : null}
              </Stack>
              <Typography color="text.secondary" variant="body2">
                {t("inventory.resultCount", { count: movementHistoryQuery.data?.count ?? 0 })}
              </Typography>
            </Stack>

            <TableContainer
              sx={{
                border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
                borderRadius: 2,
                overflowX: "auto",
                overflowY: "hidden",
              }}
            >
              <Table size="small" sx={{ tableLayout: "fixed", width: "100%" }}>
                <colgroup>
                  <col style={{ width: selectionColumnWidth }} />
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
                        disabled={rows.length === 0}
                        indeterminate={partiallySelected}
                        onChange={() => setSelectedRowIds(allSelected ? [] : rows.map((row) => row.id))}
                        size="small"
                        sx={{ display: "block", mx: "auto", p: 0.5 }}
                      />
                    </TableCell>
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
                            active={sorting.key === column.sortKey}
                            direction={sorting.key === column.sortKey ? sorting.direction : "asc"}
                            hideSortIcon={sorting.key !== column.sortKey}
                            onClick={() => {
                              setSorting((currentSorting) =>
                                currentSorting.key === column.sortKey
                                  ? {
                                      direction: currentSorting.direction === "asc" ? "desc" : "asc",
                                      key: column.sortKey!,
                                    }
                                  : {
                                      direction: "asc",
                                      key: column.sortKey!,
                                    },
                              );
                              movementView.setPage(1);
                            }}
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
                  {movementHistoryQuery.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={columns.length + 1}>
                        <Stack alignItems="center" direction="row" justifyContent="center" spacing={1.5} sx={{ py: 4 }}>
                          <CircularProgress size={20} />
                          <Typography variant="body2">{translateText("Loading data...")}</Typography>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={columns.length + 1}>
                        <Typography color="text.secondary" sx={{ py: 3 }} textAlign="center" variant="body2">
                          {translateText("No inventory movements match the current filters.")}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => {
                      const isSelected = selectedRowIds.includes(row.id);
                      const clientLabel = row.clientName
                        ? `${row.clientName}${row.clientCode ? ` [${row.clientCode}]` : ""}`
                        : "--";
                      const entryTypeLabel = row.entryTypeLabel || row.movementTypeLabel || formatStatusLabel(row.movementType);
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
                        <Fragment key={row.id}>
                          <TableRow
                            sx={{
                              "& td": {
                                backgroundColor: metaBackground,
                                borderBottomColor: "transparent",
                              },
                            }}
                          >
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
                                onChange={() =>
                                  setSelectedRowIds((currentSelectedRowIds) =>
                                    currentSelectedRowIds.includes(row.id)
                                      ? currentSelectedRowIds.filter((rowId) => rowId !== row.id)
                                      : [...currentSelectedRowIds, row.id],
                                  )
                                }
                                size="small"
                                sx={{ display: "block", mx: "auto", p: 0.5 }}
                              />
                            </TableCell>
                            <TableCell colSpan={columns.length} sx={{ px: 1.75, py: 1.1 }}>
                              <Stack
                                alignItems={{ md: "center", xs: "flex-start" }}
                                direction={{ md: "row", xs: "column" }}
                                justifyContent="space-between"
                                spacing={1}
                              >
                                <Stack direction="row" flexWrap="wrap" spacing={3} useFlexGap>
                                  <InventoryMovementMetaField label="Warehouse" value={row.warehouseName || "--"} />
                                  <InventoryMovementMetaField label="Client" value={clientLabel} />
                                  <InventoryMovementMetaField label="Type" value={entryTypeLabel} />
                                </Stack>
                                <InventoryMovementMetaField
                                  label="Time"
                                  value={row.occurredAt ? formatDateTime(row.occurredAt) : "--"}
                                />
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
                            }}
                          >
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
              count={movementHistoryQuery.data?.count ?? 0}
              onPageChange={(_event, nextPage) => movementView.setPage(nextPage + 1)}
              onRowsPerPageChange={() => undefined}
              page={Math.max(movementView.page - 1, 0)}
              rowsPerPage={movementView.pageSize}
              rowsPerPageOptions={[movementView.pageSize]}
            />
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
