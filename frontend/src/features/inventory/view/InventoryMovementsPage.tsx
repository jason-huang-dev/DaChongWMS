import { useEffect, useMemo, useState, type ReactNode } from "react";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import {
  Box,
  Button,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import { brandColors } from "@/app/brand";
import { useTenantScope } from "@/app/scope-context";
import { useI18n } from "@/app/ui-preferences";
import { inventoryApi } from "@/features/inventory/model/api";
import {
  decodeInventoryInformationMultiValue,
  encodeInventoryInformationMultiValue,
} from "@/features/inventory/model/inventory-information";
import type {
  InventoryMovementHistoryDocumentNumber,
  InventoryMovementHistoryListResponse,
  InventoryMovementHistoryRow,
  InventoryMovementHistorySortKey,
} from "@/features/inventory/model/types";
import {
  ActionIconButton,
} from "@/shared/components/action-icon-button";
import {
  DataTable,
  type DataTableColumnDefinition,
  type DataTableRowSelection,
} from "@/shared/components/data-table";
import { FilterCard } from "@/shared/components/filter-card";
import { MultiSelectFilter } from "@/shared/components/multi-select-filter";
import { RangePicker } from "@/shared/components/range-picker";
import { useDataView, type DataViewFilters } from "@/shared/hooks/use-data-view";
import { formatDateTime, formatNumber, formatStatusLabel } from "@/shared/utils/format";
import { parseApiError } from "@/shared/utils/parse-api-error";
import { apiGet } from "@/lib/http";

const movementHistoryPageSize = 15;
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

type InventoryMovementColumnDefinition = DataTableColumnDefinition<InventoryMovementHistoryRow, InventoryMovementHistorySortKey>;

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
  const movementRowSelection = useMemo<DataTableRowSelection<InventoryMovementHistoryRow>>(
    () => ({
      selectedRowIds,
      onToggleAll: (tableRows) => setSelectedRowIds((currentSelectedRowIds) => {
        const tableRowIds = tableRows.map((row) => row.id);
        const allTableRowsSelected = tableRowIds.length > 0 && tableRowIds.every((rowId) => currentSelectedRowIds.includes(rowId));
        return allTableRowsSelected ? [] : tableRowIds;
      }),
      onToggleRow: (row) =>
        setSelectedRowIds((currentSelectedRowIds) =>
          currentSelectedRowIds.includes(row.id)
            ? currentSelectedRowIds.filter((rowId) => rowId !== row.id)
            : [...currentSelectedRowIds, row.id],
        ),
    }),
    [selectedRowIds],
  );

  return (
    <Stack spacing={2.5}>
      <FilterCard>
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
              <MultiSelectFilter
                label={translateText("Warehouses")}
                onChange={(nextValues) =>
                  movementView.updateFilter(
                    "warehouses",
                    nextValues.length > 0 ? encodeInventoryInformationMultiValue(nextValues) : "",
                  )
                }
                options={filterOptions?.warehouses ?? []}
                placeholder={translateText("Warehouses")}
                selectedValues={decodeInventoryInformationMultiValue(movementView.filters.warehouses)}
              />
              <MultiSelectFilter
                label={translateText("Movement Types")}
                onChange={(nextValues) =>
                  movementView.updateFilter(
                    "movementTypes",
                    nextValues.length > 0 ? encodeInventoryInformationMultiValue(nextValues) : "",
                  )
                }
                options={filterOptions?.movementTypes ?? []}
                placeholder={translateText("Movement Types")}
                selectedValues={decodeInventoryInformationMultiValue(movementView.filters.movementTypes)}
              />
              <RangePicker
                endAriaLabel={translateText("To date")}
                endValue={movementView.filters.dateTo}
                fieldSx={{
                  minWidth: { xs: "100%", md: 168 },
                  width: { md: 168 },
                }}
                inputType="date"
                onEndChange={(value) => movementView.updateFilter("dateTo", value)}
                onStartChange={(value) => movementView.updateFilter("dateFrom", value)}
                rootSx={{ flex: "0 0 auto" }}
                startAriaLabel={translateText("From date")}
                startValue={movementView.filters.dateFrom}
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
                <RangePicker
                  endAriaLabel={translateText("Maximum quantity")}
                  endInputProps={{ inputMode: "numeric", min: 0 }}
                  endPlaceholder={translateText("Max Qty")}
                  endValue={movementView.filters.quantityMax}
                  fieldSx={{
                    minWidth: { xs: "100%", md: 110 },
                    width: { md: 110 },
                    "& .MuiInputBase-input": {
                      fontSize: theme.typography.body2.fontSize,
                      py: 0.875,
                    },
                    "& .MuiOutlinedInput-root": {
                      minHeight: 34,
                    },
                  }}
                  inputType="number"
                  onEndChange={(value) => movementView.updateFilter("quantityMax", value)}
                  onStartChange={(value) => movementView.updateFilter("quantityMin", value)}
                  rootSx={{ flex: "0 0 auto" }}
                  startAriaLabel={translateText("Minimum quantity")}
                  startInputProps={{ inputMode: "numeric", min: 0 }}
                  startPlaceholder={translateText("Min Qty")}
                  startValue={movementView.filters.quantityMin}
                />
              </Stack>
              <ActionIconButton
                aria-label={translateText("Clear all filters")}
                disabled={movementView.activeFilterCount === 0}
                onClick={movementView.resetFilters}
                sx={{ flex: "0 0 auto" }}
                title={translateText("Clear all filters")}
              >
                <RestartAltRoundedIcon fontSize="small" />
              </ActionIconButton>
            </Stack>
        </Stack>
      </FilterCard>

      <DataTable
        columns={columns}
        emptyMessage="No inventory movements match the current filters."
        error={movementHistoryQuery.error ? parseApiError(movementHistoryQuery.error) : null}
        getRowId={(row) => row.id}
        isLoading={movementHistoryQuery.isLoading}
        pagination={{
          page: movementView.page,
          pageSize: movementView.pageSize,
          total: movementHistoryQuery.data?.count ?? 0,
          onPageChange: movementView.setPage,
        }}
        renderMetaRow={(row) => {
          const clientLabel = row.clientName
            ? `${row.clientName}${row.clientCode ? ` [${row.clientCode}]` : ""}`
            : "--";
          const entryTypeLabel = row.entryTypeLabel || row.movementTypeLabel || formatStatusLabel(row.movementType);

          return (
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
              <InventoryMovementMetaField label="Time" value={row.occurredAt ? formatDateTime(row.occurredAt) : "--"} />
            </Stack>
          );
        }}
        rowSelection={movementRowSelection}
        rows={rows}
        sorting={{
          direction: sorting.direction,
          onSortChange: (nextSortKey) => {
            setSorting((currentSorting) =>
              currentSorting.key === nextSortKey
                ? {
                    direction: currentSorting.direction === "asc" ? "desc" : "asc",
                    key: nextSortKey,
                  }
                : {
                    direction: "asc",
                    key: nextSortKey,
                  },
            );
            movementView.setPage(1);
          },
          sortKey: sorting.key,
        }}
        toolbar={
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
        }
      />
    </Stack>
  );
}
