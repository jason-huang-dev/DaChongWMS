import { Fragment, type ReactNode } from "react";

import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import { useI18n } from "@/app/ui-preferences";
import type { InventoryAdjustmentGroupItem, InventoryAdjustmentGroupRow } from "@/features/inventory/model/types";
import { ActionIconButton } from "@/shared/components/action-icon-button";
import { DataTable, type DataTableColumnDefinition, type DataTableRowSelection } from "@/shared/components/data-table";
import { formatDateTime, formatNumber } from "@/shared/utils/format";

interface InventoryAdjustmentsTableProps {
  activeFilterCount: number;
  error?: string | null;
  groups: InventoryAdjustmentGroupRow[];
  isLoading: boolean;
  onClearSelection: () => void;
  onOpenCreate: () => void;
  onPageChange: (page: number) => void;
  onRefresh: () => void;
  onResetFilters: () => void;
  onExport: () => void;
  page: number;
  pageSize: number;
  rowSelection: DataTableRowSelection<InventoryAdjustmentGroupRow>;
  selectedCount: number;
  total: number;
  onScrollStateChange?: (state: { isScrolled: boolean; isScrolling: boolean; scrollTop: number }) => void;
}

const INVENTORY_ADJUSTMENT_DETAIL_COLUMNS: Array<
  Pick<DataTableColumnDefinition<InventoryAdjustmentGroupRow>, "align" | "header" | "key" | "minWidth" | "width">
> = [
  {
    header: "Product Information/Box Information",
    key: "product",
    minWidth: 280,
    width: "28%",
  },
  {
    header: "Adjustment Type",
    key: "type",
    minWidth: 220,
    width: "20%",
  },
  {
    header: "Shelf",
    key: "shelf",
    minWidth: 100,
    width: "8%",
  },
  {
    align: "right",
    header: "Adjustment Qty",
    key: "quantity",
    minWidth: 140,
    width: "12%",
  },
  {
    header: "Operator",
    key: "operator",
    minWidth: 200,
    width: "16%",
  },
  {
    header: "Time",
    key: "time",
    minWidth: 180,
    width: "16%",
  },
];

const INVENTORY_ADJUSTMENT_TABLE_COLUMNS: DataTableColumnDefinition<InventoryAdjustmentGroupRow>[] =
  INVENTORY_ADJUSTMENT_DETAIL_COLUMNS.map((column) => ({
    ...column,
    render: () => null,
  }));

const INVENTORY_ADJUSTMENT_GRID_TEMPLATE_COLUMNS = INVENTORY_ADJUSTMENT_DETAIL_COLUMNS.map(({ width }) =>
  typeof width === "number" ? `${width}px` : width ?? "minmax(0, 1fr)",
).join(" ");

function InventoryAdjustmentMetaField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const { t, translate, msg } = useI18n();

  return (
    <Typography sx={{ lineHeight: 1.35 }} variant="body2">
      <Box component="span" sx={{ color: "text.secondary", fontWeight: 700 }}>
        {t(label)}:
      </Box>{" "}
      <Box component="span" sx={{ color: "text.secondary", fontWeight: 600 }}>
        {value || "--"}
      </Box>
    </Typography>
  );
}

function InventoryAdjustmentGroupGridCell({
  align = "left",
  children,
  column,
  isLastRow,
  rowIndex,
}: {
  align?: "left" | "right";
  children: ReactNode;
  column: string;
  isLastRow: boolean;
  rowIndex: number;
}) {
  const theme = useTheme();

  return (
    <Box
      data-adjustment-grid-column={column}
      data-adjustment-grid-row={rowIndex}
      sx={{
        alignItems: align === "right" ? "flex-end" : "flex-start",
        borderBottom: isLastRow ? "none" : `1px solid ${alpha(theme.palette.divider, 0.5)}`,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
        minWidth: 0,
        px: 1.25,
        py: 1,
        textAlign: align,
      }}
    >
      {children}
    </Box>
  );
}

function InventoryAdjustmentProductBlock({ item }: { item: InventoryAdjustmentGroupItem }) {
  const secondaryLine = [item.lotNumber, item.serialNumber].filter(Boolean).join(" / ");

  return (
    <Stack spacing={0.25} sx={{ minWidth: 0, width: "100%" }}>
      <Typography sx={{ fontWeight: 800, lineHeight: 1.25, overflowWrap: "anywhere" }} variant="body2">
        {item.goodsCode}
      </Typography>
      <Typography
        color="text.secondary"
        sx={{
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: 2,
          display: "-webkit-box",
          lineHeight: 1.25,
          overflow: "hidden",
          overflowWrap: "anywhere",
        }}
        title={item.productName || "--"}
        variant="body2"
      >
        {item.productName || "--"}
      </Typography>
      {secondaryLine ? (
        <Typography color="text.secondary" sx={{ lineHeight: 1.2, overflowWrap: "anywhere" }} title={secondaryLine} variant="caption">
          {secondaryLine}
        </Typography>
      ) : null}
    </Stack>
  );
}

function InventoryAdjustmentTypeText({ item }: { item: InventoryAdjustmentGroupItem }) {
  return (
    <Typography
      sx={{
        WebkitBoxOrient: "vertical",
        WebkitLineClamp: 2,
        display: "-webkit-box",
        fontWeight: 700,
        lineHeight: 1.25,
        overflow: "hidden",
        overflowWrap: "anywhere",
        width: "100%",
      }}
      title={item.adjustmentTypeLabel}
      variant="body2"
    >
      {item.adjustmentTypeLabel}
    </Typography>
  );
}

function InventoryAdjustmentQuantityText({ item }: { item: InventoryAdjustmentGroupItem }) {
  const theme = useTheme();

  return (
    <Typography
      noWrap
      sx={{
        color: item.signedQuantity >= 0 ? theme.palette.success.main : theme.palette.error.main,
        fontWeight: 800,
        lineHeight: 1.25,
        width: "100%",
      }}
      variant="body2"
    >
      {item.signedQuantity > 0 ? `+${formatNumber(item.quantity)}` : formatNumber(item.signedQuantity)}
    </Typography>
  );
}

function InventoryAdjustmentOperatorText({ item }: { item: InventoryAdjustmentGroupItem }) {
  return (
    <Typography
      sx={{
        WebkitBoxOrient: "vertical",
        WebkitLineClamp: 2,
        display: "-webkit-box",
        fontWeight: 700,
        lineHeight: 1.25,
        overflow: "hidden",
        overflowWrap: "anywhere",
        width: "100%",
      }}
      title={item.performedBy}
      variant="body2"
    >
      {item.performedBy}
    </Typography>
  );
}

function InventoryAdjustmentGroupDetailGrid({ group }: { group: InventoryAdjustmentGroupRow }) {
  return (
    <Box
      data-adjustment-grid="true"
      sx={{
        display: "grid",
        gridTemplateColumns: INVENTORY_ADJUSTMENT_GRID_TEMPLATE_COLUMNS,
        minWidth: 0,
      }}
    >
      {group.items.map((item, index) => {
        const isLastRow = index === group.items.length - 1;

        return (
          <Fragment key={item.id}>
            <InventoryAdjustmentGroupGridCell column="product" isLastRow={isLastRow} rowIndex={index}>
              <InventoryAdjustmentProductBlock item={item} />
            </InventoryAdjustmentGroupGridCell>
            <InventoryAdjustmentGroupGridCell column="type" isLastRow={isLastRow} rowIndex={index}>
              <InventoryAdjustmentTypeText item={item} />
            </InventoryAdjustmentGroupGridCell>
            <InventoryAdjustmentGroupGridCell column="shelf" isLastRow={isLastRow} rowIndex={index}>
              <Typography noWrap sx={{ fontWeight: 700, lineHeight: 1.25, width: "100%" }} title={item.shelfCode} variant="body2">
                {item.shelfCode}
              </Typography>
            </InventoryAdjustmentGroupGridCell>
            <InventoryAdjustmentGroupGridCell align="right" column="quantity" isLastRow={isLastRow} rowIndex={index}>
              <InventoryAdjustmentQuantityText item={item} />
            </InventoryAdjustmentGroupGridCell>
            <InventoryAdjustmentGroupGridCell column="operator" isLastRow={isLastRow} rowIndex={index}>
              <InventoryAdjustmentOperatorText item={item} />
            </InventoryAdjustmentGroupGridCell>
            <InventoryAdjustmentGroupGridCell column="time" isLastRow={isLastRow} rowIndex={index}>
              <Typography noWrap sx={{ fontWeight: 700, lineHeight: 1.25, width: "100%" }} variant="body2">
                {item.occurredAt ? formatDateTime(item.occurredAt) : "--"}
              </Typography>
            </InventoryAdjustmentGroupGridCell>
          </Fragment>
        );
      })}
    </Box>
  );
}

export function InventoryAdjustmentsTable({
  activeFilterCount,
  error,
  groups,
  isLoading,
  onClearSelection,
  onOpenCreate,
  onPageChange,
  onRefresh,
  onResetFilters,
  onExport,
  page,
  pageSize,
  rowSelection,
  selectedCount,
  total,
  onScrollStateChange,
}: InventoryAdjustmentsTableProps) {
  const theme = useTheme();
  const { t, translate, msg } = useI18n();

  return (
    <DataTable
      columns={INVENTORY_ADJUSTMENT_TABLE_COLUMNS}
      emptyMessage="No inventory adjustments match the current filters."
      error={error}
      fillHeight
      getRowId={(group) => group.id}
      isLoading={isLoading}
      onScrollStateChange={onScrollStateChange}
      pagination={{
        page,
        pageSize,
        total,
        onPageChange,
      }}
      renderMetaRow={(group) => (
        <Stack
          alignItems={{ md: "center", xs: "flex-start" }}
          direction={{ md: "row", xs: "column" }}
          justifyContent="space-between"
          spacing={1}
        >
          <Stack direction="row" flexWrap="wrap" spacing={3} useFlexGap>
            <InventoryAdjustmentMetaField label="Adjustment No." value={group.adjustmentNumber} />
            <InventoryAdjustmentMetaField label="Warehouse" value={group.warehouseName} />
            <InventoryAdjustmentMetaField label="Note" value={group.note} />
          </Stack>
          <InventoryAdjustmentMetaField
            label="Latest Time"
            value={group.latestOccurredAt ? formatDateTime(group.latestOccurredAt) : "--"}
          />
        </Stack>
      )}
      renderDetailContent={(group) => <InventoryAdjustmentGroupDetailGrid group={group} />}
      rowSelection={rowSelection}
      rows={groups}
      stickyHeader
      toolbar={
        <Stack
          alignItems={{ lg: "center", xs: "stretch" }}
          direction={{ lg: "row", xs: "column" }}
          justifyContent="space-between"
          spacing={1}
          sx={{ minWidth: 0 }}
        >
          <Stack alignItems={{ md: "center", xs: "stretch" }} direction={{ md: "row", xs: "column" }} spacing={1}>
            <Button onClick={onOpenCreate} startIcon={<AddRoundedIcon />} variant="contained">
              {t("Create Adjustment List")}
            </Button>
            <Button
              color="inherit"
              disabled={groups.length === 0}
              onClick={onExport}
              startIcon={<DownloadOutlinedIcon />}
              variant="outlined"
            >
              {t(selectedCount > 0 ? "Export selected" : "Export")}
            </Button>
            {selectedCount > 0 ? (
              <>
                <Chip color="primary" label={t("bulk.selectedCount", { count: selectedCount })} size="small" />
                <Button color="inherit" onClick={onClearSelection} size="small">
                  {t("Clear selection")}
                </Button>
              </>
            ) : null}
          </Stack>
          <Stack alignItems="center" direction="row" spacing={0.5} sx={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Typography color="text.secondary" sx={{ fontSize: theme.typography.pxToRem(12) }} variant="body2">
              {t("inventory.resultCount", { count: total })}
            </Typography>
            <ActionIconButton aria-label="Refresh adjustments" onClick={onRefresh} title="Refresh adjustments">
              <RefreshRoundedIcon fontSize="small" />
            </ActionIconButton>
            <ActionIconButton
              aria-label="Clear adjustment filters"
              disabled={activeFilterCount === 0}
              onClick={onResetFilters}
              title="Clear adjustment filters"
            >
              <RestartAltRoundedIcon fontSize="small" />
            </ActionIconButton>
          </Stack>
        </Stack>
      }
      toolbarPlacement="inner"
    />
  );
}
