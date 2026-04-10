import type { ReactNode } from "react";

import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import { useI18n } from "@/app/ui-preferences";
import type { InventoryAdjustmentGroupItem, InventoryAdjustmentGroupRow } from "@/features/inventory/model/types";
import { ActionIconButton } from "@/shared/components/action-icon-button";
import { DataTable, type DataTableRowSelection } from "@/shared/components/data-table";
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

function InventoryAdjustmentMetaField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <Typography sx={{ lineHeight: 1.35 }} variant="body2">
      <Box component="span" sx={{ color: "text.secondary", fontWeight: 700 }}>
        {label}:
      </Box>{" "}
      <Box component="span" sx={{ color: "text.secondary", fontWeight: 600 }}>
        {value || "--"}
      </Box>
    </Typography>
  );
}

function InventoryAdjustmentLineList<TItem>({
  align = "left",
  items,
  renderItem,
}: {
  align?: "left" | "right";
  items: TItem[];
  renderItem: (item: TItem) => ReactNode;
}) {
  const theme = useTheme();

  return (
    <Stack
      divider={<Box sx={{ borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}` }} />}
      spacing={1}
      sx={{ minWidth: 0 }}
    >
      {items.map((item, index) => (
        <Box key={index} sx={{ minWidth: 0, textAlign: align }}>
          {renderItem(item)}
        </Box>
      ))}
    </Stack>
  );
}

function InventoryAdjustmentProductCell({ group }: { group: InventoryAdjustmentGroupRow }) {
  return (
    <InventoryAdjustmentLineList
      items={group.items}
      renderItem={(item) => (
        <Stack spacing={0.35} sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, overflowWrap: "anywhere" }} variant="body2">
            {item.goodsCode}
          </Typography>
          <Typography color="text.secondary" sx={{ overflowWrap: "anywhere" }} variant="body2">
            {item.productName || "--"}
          </Typography>
          {item.lotNumber || item.serialNumber ? (
            <Typography color="text.secondary" sx={{ overflowWrap: "anywhere" }} variant="caption">
              {[item.lotNumber, item.serialNumber].filter(Boolean).join(" / ")}
            </Typography>
          ) : null}
        </Stack>
      )}
    />
  );
}

function InventoryAdjustmentTypeCell({ group }: { group: InventoryAdjustmentGroupRow }) {
  return (
    <InventoryAdjustmentLineList
      items={group.items}
      renderItem={(item) => (
        <Typography sx={{ fontWeight: 700, overflowWrap: "anywhere" }} variant="body2">
          {item.adjustmentTypeLabel}
        </Typography>
      )}
    />
  );
}

function InventoryAdjustmentShelfCell({ group }: { group: InventoryAdjustmentGroupRow }) {
  return (
    <InventoryAdjustmentLineList
      items={group.items}
      renderItem={(item) => (
        <Typography sx={{ fontWeight: 700 }} variant="body2">
          {item.shelfCode}
        </Typography>
      )}
    />
  );
}

function InventoryAdjustmentQuantityCell({ group }: { group: InventoryAdjustmentGroupRow }) {
  const theme = useTheme();

  return (
    <InventoryAdjustmentLineList
      align="right"
      items={group.items}
      renderItem={(item) => (
        <Typography
          sx={{
            color: item.signedQuantity >= 0 ? theme.palette.success.main : theme.palette.error.main,
            fontWeight: 800,
          }}
          variant="body2"
        >
          {item.signedQuantity > 0 ? `+${formatNumber(item.quantity)}` : formatNumber(item.signedQuantity)}
        </Typography>
      )}
    />
  );
}

function InventoryAdjustmentOperatorCell({ group }: { group: InventoryAdjustmentGroupRow }) {
  return (
    <InventoryAdjustmentLineList
      items={group.items}
      renderItem={(item) => (
        <Typography sx={{ fontWeight: 700, overflowWrap: "anywhere" }} variant="body2">
          {item.performedBy}
        </Typography>
      )}
    />
  );
}

function InventoryAdjustmentTimeCell({ group }: { group: InventoryAdjustmentGroupRow }) {
  return (
    <InventoryAdjustmentLineList
      items={group.items}
      renderItem={(item) => (
        <Typography sx={{ fontWeight: 700, whiteSpace: "nowrap" }} variant="body2">
          {item.occurredAt ? formatDateTime(item.occurredAt) : "--"}
        </Typography>
      )}
    />
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
  const { t } = useI18n();

  return (
    <DataTable
      columns={[
        {
          header: "Product Information/Box Information",
          key: "product",
          minWidth: 280,
          render: (group) => <InventoryAdjustmentProductCell group={group} />,
          width: "28%",
        },
        {
          header: "Adjustment Type",
          key: "type",
          minWidth: 220,
          render: (group) => <InventoryAdjustmentTypeCell group={group} />,
          width: "20%",
        },
        {
          header: "Shelf",
          key: "shelf",
          minWidth: 100,
          render: (group) => <InventoryAdjustmentShelfCell group={group} />,
          width: "8%",
        },
        {
          align: "right",
          header: "Adjustment Qty",
          key: "quantity",
          minWidth: 140,
          render: (group) => <InventoryAdjustmentQuantityCell group={group} />,
          width: "12%",
        },
        {
          header: "Operator",
          key: "operator",
          minWidth: 200,
          render: (group) => <InventoryAdjustmentOperatorCell group={group} />,
          width: "16%",
        },
        {
          header: "Time",
          key: "time",
          minWidth: 180,
          render: (group) => <InventoryAdjustmentTimeCell group={group} />,
          width: "16%",
        },
      ]}
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
              Create Adjustment List
            </Button>
            <Button
              color="inherit"
              disabled={groups.length === 0}
              onClick={onExport}
              startIcon={<DownloadOutlinedIcon />}
              variant="outlined"
            >
              {selectedCount > 0 ? "Export selected" : "Export"}
            </Button>
            {selectedCount > 0 ? (
              <>
                <Chip color="primary" label={t("bulk.selectedCount", { count: selectedCount })} size="small" />
                <Button color="inherit" onClick={onClearSelection} size="small">
                  Clear selection
                </Button>
              </>
            ) : null}
          </Stack>
          <Stack alignItems="center" direction="row" spacing={0.5} sx={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Typography color="text.secondary" sx={{ fontSize: theme.typography.pxToRem(12) }} variant="body2">
              {total} adjustments
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
