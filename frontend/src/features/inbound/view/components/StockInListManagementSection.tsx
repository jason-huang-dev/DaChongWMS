import { useMemo, type ReactNode } from "react";

import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { Box, Button, Chip, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { Link as RouterLink } from "react-router-dom";

import { useI18n } from "@/app/ui-preferences";
import {
  buildStockInListTabFilters,
  countStockInListActiveFilters,
  resolveStockInListDateField,
  resolveStockInListSearchField,
  resolveStockInListSearchValue,
  resolveStockInListStatusTab,
  type StockInListDateField,
  type StockInListFilters,
  type StockInListSearchField,
} from "@/features/inbound/model/stock-in-list-management";
import { sumPurchaseOrderLineQuantity } from "@/features/inbound/model/purchase-order-metrics";
import type { PurchaseOrderRecord } from "@/features/inbound/model/types";
import { ActionIconButton } from "@/shared/components/action-icon-button";
import { DataViewSavedViewControls } from "@/shared/components/data-view-saved-view-controls";
import { DataTable, type DataTableColumnDefinition } from "@/shared/components/data-table";
import { FieldSelectorFilter } from "@/shared/components/field-selector-filter";
import { FilterCard } from "@/shared/components/filter-card";
import { PageTabs } from "@/shared/components/page-tabs";
import { RangePicker } from "@/shared/components/range-picker";
import { RecordLink } from "@/shared/components/record-link";
import { StatusChip } from "@/shared/components/status-chip";
import { StickyTableLayout } from "@/shared/components/sticky-table-layout";
import { useCollapsibleTablePageChrome } from "@/shared/hooks/use-collapsible-table-page-chrome";
import type { UseDataViewResult } from "@/shared/hooks/use-data-view";
import type { PaginatedQueryState } from "@/shared/types/query";
import { formatDateTime, formatNumber } from "@/shared/utils/format";
import { parseApiError } from "@/shared/utils/parse-api-error";

interface StockInListManagementSectionProps {
  activeWarehouse?: { warehouse_name: string } | null;
  purchaseOrdersQuery: PaginatedQueryState<PurchaseOrderRecord>;
  purchaseOrdersView: UseDataViewResult<StockInListFilters>;
  toolbarActions?: ReactNode;
}

const stockInStatusTabItems = [
  { label: "All", value: "all" },
  { label: "Open / partial", value: "active" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
] as const;

const stockInSearchFieldOptions: Array<{ label: string; value: StockInListSearchField }> = [
  { label: "PO", value: "po_number" },
  { label: "Client", value: "customer" },
  { label: "Supplier", value: "supplier" },
  { label: "Reference", value: "reference_code" },
];

const stockInSearchPlaceholders: Record<StockInListSearchField, string> = {
  po_number: "Search purchase order",
  customer: "Search client",
  supplier: "Search supplier",
  reference_code: "Search reference code",
};

const stockInDateFieldOptions: Array<{ label: string; value: StockInListDateField }> = [
  { label: "Create Time", value: "create_time" },
  { label: "Expected arrival", value: "expected_arrival_date" },
];

function buildPurchaseOrderClientLabel(purchaseOrder: PurchaseOrderRecord) {
  if (purchaseOrder.customer_name?.trim()) {
    return purchaseOrder.customer_code?.trim()
      ? `${purchaseOrder.customer_name} [${purchaseOrder.customer_code}]`
      : purchaseOrder.customer_name;
  }
  if (purchaseOrder.customer_code?.trim()) {
    return purchaseOrder.customer_code;
  }
  return "--";
}

function StockInListMetaField({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" spacing={0.75} sx={{ minWidth: 0 }}>
      <Typography color="text.secondary" sx={{ flex: "0 0 auto", fontSize: 12, fontWeight: 600 }} variant="caption">
        {label}
      </Typography>
      <Typography sx={{ fontSize: 12, fontWeight: 500, minWidth: 0 }} variant="body2">
        {value}
      </Typography>
    </Stack>
  );
}

function StockInListFilters({
  activeFilterCount,
  activeWarehouseName,
  dataView,
}: {
  activeFilterCount: number;
  activeWarehouseName?: string | null;
  dataView: UseDataViewResult<StockInListFilters>;
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t, translate, msg } = useI18n();
  const searchField = resolveStockInListSearchField(dataView.filters);
  const searchValue = resolveStockInListSearchValue(dataView.filters);
  const dateField = resolveStockInListDateField(dataView.filters);
  const statusTab = resolveStockInListStatusTab(dataView.filters);
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
          ariaLabel={t("Stock-in queue statuses")}
          items={stockInStatusTabItems.map((item) => ({ label: translate(item.label), value: item.value }))}
          onChange={(value) => {
            const nextFilters = buildStockInListTabFilters(value);
            dataView.updateFilter("status", nextFilters.status);
            dataView.updateFilter("status__in", nextFilters.status__in);
          }}
          value={statusTab}
        />
      }
    >
      <Stack spacing={1.25}>
        <Stack direction="row" flexWrap="wrap" spacing={0.75} useFlexGap>
          {activeWarehouseName ? (
            <Chip
              color="primary"
              label={translate(msg("shell.warehouseChip", { label: activeWarehouseName }))}
              size="small"
              variant="outlined"
            />
          ) : null}
          <Chip label={t("filters.activeCount", { count: activeFilterCount })} size="small" variant="outlined" />
        </Stack>
        <Box
          sx={{
            alignItems: "start",
            display: "grid",
            gap: 1,
            gridTemplateColumns: {
              lg: "minmax(0, 1fr) minmax(0, 1fr) auto",
              xs: "minmax(0, 1fr)",
            },
            minWidth: 0,
          }}
        >
          <RangePicker
            endAriaLabel={t("Time to")}
            endValue={dataView.filters.dateTo}
            fieldSx={{
              minWidth: { md: 160, xs: "100%" },
              width: { md: 160 },
              ...compoundFieldSx,
            }}
            inputType="date"
            leadingContent={
              <TextField
                hiddenLabel
                onChange={(event) => dataView.updateFilter("dateField", event.target.value)}
                select
                size="small"
                value={dateField}
                slotProps={{
                  htmlInput: {
                    "aria-label": t("Stock-in date field"),
                  },
                }}
                sx={{
                  minWidth: { md: 180, xs: "100%" },
                  width: { md: 180, xs: "100%" },
                  ...compoundFieldSx,
                }}
              >
                {stockInDateFieldOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {translate(option.label)}
                  </MenuItem>
                ))}
              </TextField>
            }
            onEndChange={(value) => dataView.updateFilter("dateTo", value)}
            onStartChange={(value) => dataView.updateFilter("dateFrom", value)}
            rootSx={{
              height: "auto",
              minHeight: 44,
              px: 0.75,
              py: 0.45,
            }}
            startAriaLabel={t("Time from")}
            startValue={dataView.filters.dateFrom}
          />
          <FieldSelectorFilter
            sx={{
              minHeight: 44,
              px: 0.75,
              py: 0.45,
            }}
          >
            <TextField
              hiddenLabel
              onChange={(event) => {
                dataView.updateFilter("searchField", event.target.value);
                if (dataView.filters.po_number__icontains && !dataView.filters.searchValue) {
                  dataView.updateFilter("searchValue", dataView.filters.po_number__icontains);
                }
                dataView.updateFilter("po_number__icontains", "");
              }}
              select
              size="small"
              value={searchField}
              slotProps={{
                htmlInput: {
                  "aria-label": t("Search field"),
                },
              }}
              sx={{
                flex: "0 0 152px",
                minWidth: 152,
                width: 152,
                ...compoundFieldSx,
              }}
            >
              {stockInSearchFieldOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {translate(option.label)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              hiddenLabel
              onChange={(event) => {
                dataView.updateFilter("po_number__icontains", "");
                dataView.updateFilter("searchValue", event.target.value);
              }}
              placeholder={translate(stockInSearchPlaceholders[searchField])}
              size="small"
              value={searchValue}
              slotProps={{
                htmlInput: {
                  "aria-label": t("Search content"),
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
          <Button
            color="inherit"
            onClick={dataView.resetFilters}
            size="small"
            sx={{
              alignSelf: { lg: "center", xs: "stretch" },
              minHeight: 44,
              px: 2,
              whiteSpace: "nowrap",
            }}
            variant="outlined"
          >
            {t("Reset")}
          </Button>
        </Box>
      </Stack>
    </FilterCard>
  );
}

function StockInListTableToolbar({
  actions,
  dataView,
  total,
}: {
  actions?: ReactNode;
  dataView: UseDataViewResult<StockInListFilters>;
  total: number;
}) {
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
        <Typography color="text.secondary" variant="body2">
          {t("filters.resultCount", { count: total })}
        </Typography>
      </Stack>
      <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", flexWrap: "wrap" }}>
        <DataViewSavedViewControls
          onApplySavedView={dataView.applySavedView}
          onDeleteSavedView={dataView.deleteSavedView}
          onSaveSavedView={dataView.saveCurrentView}
          savedViews={dataView.savedViews}
          selectedSavedViewId={dataView.selectedSavedViewId}
        />
        {actions}
      </Stack>
    </Stack>
  );
}

function buildStockInListColumns(
  t: (key: string, params?: Record<string, string | number | null | undefined>) => string,
): Array<DataTableColumnDefinition<PurchaseOrderRecord>> {
  return [
    {
      header: t("Stock-in No."),
      key: "stockInNumber",
      minWidth: 236,
      sticky: "left",
      width: 248,
      render: (row) => (
        <Stack spacing={0.45} sx={{ minWidth: 0 }}>
          <RecordLink to={`/inbound/purchase-orders/${row.id}`}>{row.po_number}</RecordLink>
          {row.reference_code ? (
            <Typography color="text.secondary" sx={{ fontSize: 12 }} variant="body2">
              {row.reference_code}
            </Typography>
          ) : null}
        </Stack>
      ),
    },
    {
      header: t("Client"),
      key: "client",
      minWidth: 180,
      width: 188,
      render: (row) => (
        <Stack spacing={0.35}>
          <Typography fontWeight={600} variant="body2">
            {row.customer_name || row.customer_code || "--"}
          </Typography>
          {row.customer_code ? (
            <Typography color="text.secondary" sx={{ fontSize: 12 }} variant="caption">
              {row.customer_code}
            </Typography>
          ) : null}
        </Stack>
      ),
    },
    {
      header: t("Supplier"),
      key: "supplier",
      minWidth: 180,
      width: 196,
      render: (row) => row.supplier_name || "--",
    },
    {
      align: "right",
      header: t("Lines"),
      key: "lineCount",
      minWidth: 92,
      width: 92,
      render: (row) => formatNumber((row.lines ?? []).length),
    },
    {
      align: "right",
      header: t("Ordered qty"),
      key: "orderedQty",
      minWidth: 116,
      width: 124,
      render: (row) => formatNumber(sumPurchaseOrderLineQuantity(row, "ordered_qty")),
    },
    {
      align: "right",
      header: t("Received qty"),
      key: "receivedQty",
      minWidth: 116,
      width: 124,
      render: (row) => formatNumber(sumPurchaseOrderLineQuantity(row, "received_qty")),
    },
    {
      header: t("Expected arrival"),
      key: "expectedArrival",
      minWidth: 152,
      width: 160,
      render: (row) => formatDateTime(row.expected_arrival_date),
    },
    {
      header: t("Create Time"),
      key: "createTime",
      minWidth: 152,
      width: 164,
      render: (row) => formatDateTime(row.create_time),
    },
    {
      header: t("Status"),
      key: "status",
      minWidth: 130,
      width: 136,
      render: (row) => <StatusChip status={row.status} />,
    },
    {
      align: "center",
      columnVisibilityLabel: t("Operation"),
      defaultVisible: true,
      header: t("Operation"),
      hideable: false,
      key: "operation",
      minWidth: 82,
      sticky: "right",
      width: 82,
      render: (row) => (
        <ActionIconButton
          aria-label={t("Open purchase-order detail for {{poNumber}}", { poNumber: row.po_number })}
          component={RouterLink}
          title={t("Open purchase-order detail for {{poNumber}}", { poNumber: row.po_number })}
          to={`/inbound/purchase-orders/${row.id}`}
          tone="primary"
        >
          <OpenInNewRoundedIcon fontSize="small" />
        </ActionIconButton>
      ),
    },
  ];
}

export function StockInListManagementSection({
  activeWarehouse,
  purchaseOrdersQuery,
  purchaseOrdersView,
  toolbarActions,
}: StockInListManagementSectionProps) {
  const { t } = useI18n();
  const columns = useMemo(() => buildStockInListColumns(t), [t]);
  const pageChrome = useCollapsibleTablePageChrome();
  const total = purchaseOrdersQuery.data?.count ?? 0;
  const activeFilterCount = countStockInListActiveFilters(purchaseOrdersView.filters);

  return (
    <StickyTableLayout
      pageChrome={
        <Box
          aria-hidden={pageChrome.isCollapsed}
          data-collapse-progress="0.00"
          data-testid="stock-in-list-page-chrome"
          ref={pageChrome.wrapperRef}
          sx={pageChrome.wrapperSx}
        >
          <Box ref={pageChrome.contentRef}>
            <StockInListFilters
              activeFilterCount={activeFilterCount}
              activeWarehouseName={activeWarehouse?.warehouse_name}
              dataView={purchaseOrdersView}
            />
          </Box>
        </Box>
      }
      table={
        <DataTable
          columnVisibility={{
            storageKey: "inbound.stock-in-list.columns",
          }}
          columns={columns}
          emptyMessage={t("No stock-in records match the current filters.")}
          error={purchaseOrdersQuery.error ? parseApiError(purchaseOrdersQuery.error) : null}
          fillHeight
          getRowId={(row) => row.id}
          isLoading={purchaseOrdersQuery.isLoading}
          onScrollStateChange={pageChrome.handleTableScrollStateChange}
          pagination={{
            page: purchaseOrdersView.page,
            pageSize: purchaseOrdersView.pageSize,
            total,
            onPageChange: purchaseOrdersView.setPage,
          }}
          renderMetaRow={(row) => (
            <Stack
              alignItems={{ md: "center", xs: "flex-start" }}
              direction={{ md: "row", xs: "column" }}
              justifyContent="space-between"
              spacing={1}
            >
              <Stack direction="row" flexWrap="wrap" spacing={3} useFlexGap>
                <StockInListMetaField label={t("Warehouse")} value={row.warehouse_name || "--"} />
                <StockInListMetaField label={t("Client")} value={buildPurchaseOrderClientLabel(row)} />
                <StockInListMetaField label={t("Reference")} value={row.reference_code || "--"} />
              </Stack>
              <StockInListMetaField label={t("Updated Date")} value={formatDateTime(row.update_time)} />
            </Stack>
          )}
          rows={purchaseOrdersQuery.data?.results ?? []}
          stickyHeader
          toolbar={
            <StockInListTableToolbar
              actions={toolbarActions}
              dataView={purchaseOrdersView}
              total={total}
            />
          }
          toolbarPlacement="inner"
        />
      }
    />
  );
}
