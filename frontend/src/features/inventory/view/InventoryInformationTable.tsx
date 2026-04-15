import { useMemo, type ReactNode } from "react";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import {
  Box,
  Checkbox,
  Chip,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import { useI18n } from "@/app/ui-preferences";
import {
  decodeInventoryInformationMultiValue,
  encodeInventoryInformationMultiValue,
} from "@/features/inventory/model/inventory-information";
import type { InventoryInformationRow, InventoryInformationSortKey } from "@/features/inventory/model/types";
import { InventoryProductInfoCell } from "@/features/inventory/view/InventoryProductInfoCell";
import {
  ActionIconButton,
} from "@/shared/components/action-icon-button";
import {
  DataTable,
  type DataTableColumnDefinition,
  type DataTableRowSelection,
} from "@/shared/components/data-table";
import { FieldSelectorFilter } from "@/shared/components/field-selector-filter";
import { FilterCard } from "@/shared/components/filter-card";
import { MultiSelectFilter } from "@/shared/components/multi-select-filter";
import { PageTabs } from "@/shared/components/page-tabs";
import { RangePicker } from "@/shared/components/range-picker";
import { StickyTableLayout } from "@/shared/components/sticky-table-layout";
import { useCollapsibleTablePageChrome } from "@/shared/hooks/use-collapsible-table-page-chrome";
import type { DataViewFilters, UseDataViewResult } from "@/shared/hooks/use-data-view";
import { formatDateTime, formatNumber, formatStatusLabel } from "@/shared/utils/format";

export type InventoryInformationAreaFilter = "all" | "storage" | "picking" | "defect";
export type InventoryInformationProductSearchField = "merchantSku" | "merchantCode" | "productBarcode" | "productName";
export type InventoryInformationMetricField =
  | "inTransit"
  | "pendingReceival"
  | "toList"
  | "orderAllocated"
  | "availableStock"
  | "defectiveProducts"
  | "totalInventory";

export interface InventoryInformationFilters extends DataViewFilters {
  area: InventoryInformationAreaFilter;
  warehouses: string;
  clients: string;
  productSearchField: InventoryInformationProductSearchField;
  productSearchValue: string;
  shelfQuery: string;
  metricField: InventoryInformationMetricField;
  metricMin: string;
  metricMax: string;
  hideZeroStock: string;
}

export interface InventoryInformationFilterOption {
  value: string;
  label: string;
}

export interface InventoryInformationAreaTabItem {
  count: number;
  label: string;
  value: InventoryInformationAreaFilter;
}

const inventoryInformationProductSearchFieldOptions: Array<{
  label: string;
  value: InventoryInformationProductSearchField;
}> = [
  { label: "SKU", value: "merchantSku" },
  { label: "Merchant Code", value: "merchantCode" },
  { label: "Barcode", value: "productBarcode" },
  { label: "Product Name", value: "productName" },
];

const inventoryInformationProductSearchPlaceholders: Record<InventoryInformationProductSearchField, string> = {
  merchantSku: "Search SKU",
  merchantCode: "Search merchant code",
  productBarcode: "Search barcode",
  productName: "Search product name",
};

const inventoryInformationMetricFieldOptions: Array<{
  label: string;
  value: InventoryInformationMetricField;
}> = [
  { label: "In Transit", value: "inTransit" },
  { label: "Pending Receival", value: "pendingReceival" },
  { label: "To List", value: "toList" },
  { label: "Order Allocated", value: "orderAllocated" },
  { label: "Available Stock", value: "availableStock" },
  { label: "Defective Products", value: "defectiveProducts" },
  { label: "Total Inventory", value: "totalInventory" },
];

type InventoryInformationColumnDefinition = DataTableColumnDefinition<InventoryInformationRow, InventoryInformationSortKey>;

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
  const { translate } = useI18n();

  return (
    <Typography sx={{ lineHeight: 1.35 }} variant="body2">
      <Box component="span" sx={{ color: "text.secondary", fontWeight: 700 }}>
        {translate(label)}:
      </Box>{" "}
      <Box component="span" sx={{ color: "text.secondary", fontWeight: 600 }}>
        {value || "--"}
      </Box>
    </Typography>
  );
}

function buildInventoryInformationColumns(t: (key: string) => string): InventoryInformationColumnDefinition[] {
  return [
    {
      header: t("Product Info"),
      key: "productInfo",
      minWidth: 260,
      sortKey: "merchantSku",
      width: "24%",
      render: (row) => <InventoryProductInfoCell product={row} />,
    },
    {
      header: t("Shelf"),
      key: "shelf",
      minWidth: 116,
      width: "12%",
      render: (row) => <InventoryInformationShelfCell row={row} />,
    },
    {
      align: "center",
      header: t("In Transit"),
      key: "inTransit",
      minWidth: 86,
      sortKey: "inTransit",
      width: "7%",
      render: (row) => <InventoryInformationNumericCell value={row.inTransit} />,
    },
    {
      align: "center",
      header: t("Pending Receival"),
      key: "pendingReceival",
      minWidth: 108,
      sortKey: "pendingReceival",
      width: "9%",
      render: (row) => <InventoryInformationNumericCell value={row.pendingReceival} />,
    },
    {
      align: "center",
      header: t("To List"),
      key: "toList",
      minWidth: 84,
      sortKey: "toList",
      width: "7%",
      render: (row) => <InventoryInformationNumericCell value={row.toList} />,
    },
    {
      align: "center",
      header: t("Order Allocated"),
      key: "orderAllocated",
      minWidth: 110,
      sortKey: "orderAllocated",
      width: "11%",
      render: (row) => <InventoryInformationNumericCell value={row.orderAllocated} />,
    },
    {
      align: "center",
      header: t("Available Stock"),
      key: "availableStock",
      minWidth: 108,
      sortKey: "availableStock",
      width: "10%",
      render: (row) => <InventoryInformationNumericCell value={row.availableStock} />,
    },
    {
      align: "center",
      header: t("Defective Products"),
      key: "defectiveProducts",
      minWidth: 118,
      sortKey: "defectiveProducts",
      width: "10%",
      render: (row) => <InventoryInformationNumericCell value={row.defectiveProducts} />,
    },
    {
      align: "center",
      header: t("Total Inventory"),
      key: "totalInventory",
      minWidth: 110,
      sortKey: "totalInventory",
      width: "10%",
      render: (row) => <InventoryInformationNumericCell value={row.totalInventory} />,
    },
  ];
}

interface InventoryInformationToolbarProps {
  areaFilter: InventoryInformationAreaFilter;
  areaTabs: InventoryInformationAreaTabItem[];
  onAreaFilterChange: (value: InventoryInformationAreaFilter) => void;
  dataView: UseDataViewResult<InventoryInformationFilters>;
  warehouseOptions: InventoryInformationFilterOption[];
  clientOptions: InventoryInformationFilterOption[];
}

function InventoryInformationToolbar({
  areaFilter,
  areaTabs,
  onAreaFilterChange,
  dataView,
  warehouseOptions,
  clientOptions,
}: InventoryInformationToolbarProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t, translate, msg } = useI18n();
  const standaloneFieldSx = {
    minWidth: 0,
    width: "100%",
    "& .MuiInputBase-input": {
      fontSize: theme.typography.pxToRem(12),
      py: 0.75,
    },
    "& .MuiOutlinedInput-root": {
      backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.48 : 0.96),
      borderRadius: 999,
      height: 40,
      minHeight: 40,
    },
  } as const;
  const compoundFieldSx = {
    "& .MuiInputBase-input": {
      fontSize: theme.typography.pxToRem(12),
      py: 0.625,
    },
    "& .MuiOutlinedInput-root": {
      backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.48 : 0.96),
      borderRadius: 999,
      height: 34,
      minHeight: 34,
    },
  } as const;

  return (
    <Stack spacing={0}>
      <Box sx={{ pb: 1.25 }}>
        <PageTabs
          ariaLabel={t("Inventory area pages")}
          items={areaTabs}
          onChange={onAreaFilterChange}
          value={areaFilter}
        />
      </Box>
      <Stack spacing={0.875} sx={{ minWidth: 0, pb: 0.125, pt: 0.125 }}>
        <Box
          sx={{
            alignItems: "stretch",
            display: "grid",
            gap: 0.875,
            gridTemplateColumns: {
              lg: "repeat(3, minmax(0, 1fr))",
              sm: "repeat(2, minmax(0, 1fr))",
              xs: "minmax(0, 1fr)",
            },
            minWidth: 0,
          }}
        >
          <MultiSelectFilter
            label={t("Warehouse filter")}
            onChange={(nextValues) =>
              dataView.updateFilter(
                "warehouses",
                nextValues.length > 0 ? encodeInventoryInformationMultiValue(nextValues) : "",
              )
            }
            options={warehouseOptions}
            placeholder={t("Warehouse")}
            selectedValues={decodeInventoryInformationMultiValue(dataView.filters.warehouses)}
            sx={standaloneFieldSx}
          />
          <MultiSelectFilter
            label={t("Client filter")}
            onChange={(nextValues) =>
              dataView.updateFilter(
                "clients",
                nextValues.length > 0 ? encodeInventoryInformationMultiValue(nextValues) : "",
              )
            }
            options={clientOptions}
            placeholder={t("Client")}
            selectedValues={decodeInventoryInformationMultiValue(dataView.filters.clients)}
            sx={standaloneFieldSx}
          />
          <TextField
            hiddenLabel
            onChange={(event) => dataView.updateFilter("shelfQuery", event.target.value)}
            placeholder={t("Shelf")}
            size="small"
            value={dataView.filters.shelfQuery}
            slotProps={{
              htmlInput: {
                "aria-label": t("Shelf"),
                autoCapitalize: "characters",
                autoCorrect: "off",
                spellCheck: false,
              },
            }}
            sx={{
              ...standaloneFieldSx,
              gridColumn: {
                lg: "auto",
                sm: "1 / -1",
                xs: "auto",
              },
            }}
          />
        </Box>
        <Box
          sx={{
            alignItems: "start",
            display: "grid",
            gap: 0.875,
            gridTemplateColumns: {
              md: "minmax(0, 1fr) auto",
              xs: "minmax(0, 1fr)",
            },
            minWidth: 0,
          }}
        >
          <FieldSelectorFilter>
            <TextField
              hiddenLabel
              onChange={(event) =>
                dataView.updateFilter("productSearchField", event.target.value as InventoryInformationProductSearchField)
              }
              size="small"
              select
              value={dataView.filters.productSearchField}
              slotProps={{
                htmlInput: {
                  "aria-label": t("Product info field"),
                },
              }}
              sx={{
                flex: "0 0 156px",
                minWidth: 156,
                width: 156,
                ...compoundFieldSx,
              }}
            >
              {inventoryInformationProductSearchFieldOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {translate(option.label)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              hiddenLabel
              onChange={(event) => dataView.updateFilter("productSearchValue", event.target.value)}
              placeholder={translate(inventoryInformationProductSearchPlaceholders[dataView.filters.productSearchField])}
              size="small"
              value={dataView.filters.productSearchValue}
              slotProps={{
                htmlInput: {
                  "aria-label": t("Product info"),
                  autoCapitalize: "none",
                  autoCorrect: "off",
                  spellCheck: false,
                },
              }}
              sx={{
                flex: "1 1 220px",
                minWidth: 180,
                ...compoundFieldSx,
              }}
            />
          </FieldSelectorFilter>
          <RangePicker
            endAriaLabel={t("Maximum value")}
            endInputProps={{ inputMode: "numeric" }}
            endPlaceholder={t("Max")}
            endValue={dataView.filters.metricMax}
            fieldSx={{
              minWidth: { md: 112, xs: "100%" },
              width: { md: 112 },
              ...compoundFieldSx,
            }}
            inputType="number"
            leadingContent={
              <TextField
                hiddenLabel
                onChange={(event) => dataView.updateFilter("metricField", event.target.value as InventoryInformationMetricField)}
                select
                size="small"
                value={dataView.filters.metricField}
                slotProps={{
                  htmlInput: {
                    "aria-label": t("Numeric column"),
                  },
                }}
                sx={{
                  minWidth: { md: 180, xs: "100%" },
                  width: { md: 180, xs: "100%" },
                  ...compoundFieldSx,
                }}
              >
                {inventoryInformationMetricFieldOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {translate(option.label)}
                  </MenuItem>
                ))}
              </TextField>
            }
            onEndChange={(value) => dataView.updateFilter("metricMax", value)}
            onStartChange={(value) => dataView.updateFilter("metricMin", value)}
            rootSx={{
              height: "auto",
              justifySelf: {
                md: "start",
                xs: "stretch",
              },
              maxWidth: "100%",
              minHeight: 42,
              px: 0.625,
              py: 0.375,
              width: {
                md: "fit-content",
                xs: "100%",
              },
            }}
            startAriaLabel={t("Minimum value")}
            startInputProps={{ inputMode: "numeric" }}
            startPlaceholder={t("Min")}
            startValue={dataView.filters.metricMin}
          />
        </Box>
      </Stack>
    </Stack>
  );
}

interface InventoryInformationPageChromeProps extends InventoryInformationToolbarProps {
  hideZeroStock: boolean;
  onHideZeroStockChange: (checked: boolean) => void;
}

function InventoryInformationPageChrome({
  areaFilter,
  areaTabs,
  clientOptions,
  dataView,
  hideZeroStock,
  onAreaFilterChange,
  onHideZeroStockChange,
  warehouseOptions,
}: InventoryInformationPageChromeProps) {
  const { t, translate, msg } = useI18n();

  return (
    <FilterCard
      contentSx={{
        pb: "14px !important",
        pt: 1.25,
      }}
    >
      <Stack spacing={0.625}>
        <InventoryInformationToolbar
          areaFilter={areaFilter}
          areaTabs={areaTabs}
          clientOptions={clientOptions}
          dataView={dataView}
          onAreaFilterChange={onAreaFilterChange}
          warehouseOptions={warehouseOptions}
        />
        <Box
          component="label"
          sx={(theme) => ({
            alignItems: "center",
            alignSelf: "flex-start",
            backgroundColor: alpha(theme.palette.background.paper, theme.palette.mode === "dark" ? 0.48 : 0.92),
            border: `1px solid ${alpha(theme.palette.divider, 0.82)}`,
            borderRadius: 999,
            cursor: "pointer",
            display: "inline-flex",
            gap: 0.25,
            pl: 0.35,
            pr: 0.8,
            py: 0.05,
          })}
        >
          <Checkbox
            checked={hideZeroStock}
            onChange={(event) => onHideZeroStockChange(event.target.checked)}
            size="small"
            sx={{ p: 0.3 }}
          />
          <Typography
            sx={(theme) => ({
              fontSize: theme.typography.pxToRem(12),
              fontWeight: 600,
              whiteSpace: "nowrap",
            })}
            variant="body2"
          >
            {t("In stock only")}
          </Typography>
        </Box>
      </Stack>
    </FilterCard>
  );
}

interface InventoryInformationTableToolbarProps {
  activeFilterCount: number;
  actions?: ReactNode;
  onResetFilters: () => void;
  selectedCount: number;
  selectionBar?: ReactNode;
  total: number;
}

function InventoryInformationTableToolbar({
  activeFilterCount,
  actions,
  onResetFilters,
  selectedCount,
  selectionBar,
  total,
}: InventoryInformationTableToolbarProps) {
  const theme = useTheme();
  const { t, translate, msg } = useI18n();

  return (
    <Stack
      alignItems={{ xs: "stretch", md: "center" }}
      direction={{ xs: "column", md: "row" }}
      justifyContent="space-between"
      spacing={0.5}
      sx={{ minWidth: 0 }}
    >
      <Stack
        alignItems={{ xs: "stretch", md: "center" }}
        direction={{ xs: "column", md: "row" }}
        spacing={0.5}
        sx={{ flex: "1 1 auto", minWidth: 0 }}
      >
        <Chip
          color={selectedCount > 0 ? "primary" : "default"}
          label={t("bulk.selectedCount", { count: selectedCount })}
          size="small"
          sx={{ alignSelf: { xs: "flex-start", md: "center" }, flex: "0 0 auto" }}
        />
        <Typography
          color="text.secondary"
          sx={{ fontSize: theme.typography.pxToRem(12), whiteSpace: "nowrap" }}
          variant="body2"
        >
          {t("inventory.resultCount", { count: total })}
        </Typography>
        {selectionBar ? (
          <Box
            sx={(theme) => ({
              flex: "0 1 auto",
              minWidth: 0,
              "& .MuiButton-root": {
                fontSize: theme.typography.pxToRem(12),
                minHeight: 28,
                px: 1,
              },
              "& .MuiChip-label": {
                fontSize: theme.typography.pxToRem(10.5),
              },
              "& .MuiTypography-body2": {
                fontSize: theme.typography.pxToRem(12),
              },
            })}
          >
            {selectionBar}
          </Box>
        ) : null}
      </Stack>
      <Stack
        alignItems="center"
        direction="row"
        spacing={0.5}
        sx={{ flex: "0 0 auto", flexWrap: "wrap", justifyContent: { xs: "flex-start", md: "flex-end" } }}
      >
        {actions}
        <ActionIconButton
          aria-label={t("Clear all filters")}
          disabled={activeFilterCount === 0}
          onClick={onResetFilters}
          sx={{ flex: "0 0 auto" }}
          title={t("Clear all filters")}
        >
          <RestartAltRoundedIcon fontSize="small" />
        </ActionIconButton>
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
  activeFilterCount: number;
  areaFilter: InventoryInformationAreaFilter;
  areaTabs: InventoryInformationAreaTabItem[];
  actions?: ReactNode;
  hideZeroStock: boolean;
  onAreaFilterChange: (value: InventoryInformationAreaFilter) => void;
  onHideZeroStockChange: (checked: boolean) => void;
  rowSelection?: DataTableRowSelection<InventoryInformationRow>;
  selectedCount: number;
  selectionBar?: ReactNode;
  warehouseOptions: InventoryInformationFilterOption[];
  clientOptions: InventoryInformationFilterOption[];
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
  activeFilterCount,
  areaFilter,
  areaTabs,
  actions,
  hideZeroStock,
  onAreaFilterChange,
  onHideZeroStockChange,
  rowSelection,
  selectedCount,
  selectionBar,
  warehouseOptions,
  clientOptions,
  sortKey,
  sortDirection,
  onSortChange,
}: InventoryInformationTableProps) {
  const { t, translate, msg } = useI18n();
  const columns = useMemo(() => buildInventoryInformationColumns(t), [t]);
  const pageChrome = useCollapsibleTablePageChrome();

  return (
    <StickyTableLayout
      pageChrome={
        <Box
          aria-hidden={pageChrome.isCollapsed}
          data-collapse-progress="0.00"
          data-testid="inventory-information-page-chrome"
          ref={pageChrome.wrapperRef}
          sx={pageChrome.wrapperSx}
        >
          <Box ref={pageChrome.contentRef}>
            <InventoryInformationPageChrome
              areaFilter={areaFilter}
              areaTabs={areaTabs}
              clientOptions={clientOptions}
              dataView={dataView}
              hideZeroStock={hideZeroStock}
              onAreaFilterChange={onAreaFilterChange}
              onHideZeroStockChange={onHideZeroStockChange}
              warehouseOptions={warehouseOptions}
            />
          </Box>
        </Box>
      }
      table={
        <DataTable
          columns={columns}
          emptyMessage={t("No inventory information matches the current filters.")}
          error={error}
          fillHeight
          getRowId={(row) => row.id}
          isLoading={isLoading}
          pagination={{
            page: dataView.page,
            pageSize: dataView.pageSize,
            total,
            onPageChange: dataView.setPage,
          }}
          renderMetaRow={(row) => (
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
                <InventoryInformationMetaField label="Status" value={translate(buildInventoryInformationStatusLabel(row))} />
              </Stack>
              <InventoryInformationMetaField label="Listed" value={buildInventoryInformationListedLabel(row.listingTime)} />
            </Stack>
          )}
          rowSelection={rowSelection}
          rows={rows}
          sorting={{
            direction: sortDirection,
            onSortChange: onSortChange,
            sortKey,
          }}
          stickyHeader
          toolbar={
            <InventoryInformationTableToolbar
              activeFilterCount={activeFilterCount}
              actions={actions}
              onResetFilters={dataView.resetFilters}
              selectedCount={selectedCount}
              selectionBar={selectionBar}
              total={total}
            />
          }
          onScrollStateChange={pageChrome.handleTableScrollStateChange}
          toolbarPlacement="inner"
        />
      }
    />
  );
}
