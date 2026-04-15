import { useMemo } from "react";

import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import { Alert, Button, Dialog, DialogContent, DialogTitle, Divider, Stack } from "@mui/material";

import { useI18n } from "@/app/ui-preferences";
import { useInventoryTransferWorkbenchController } from "@/features/inventory/controller/useInventoryCrossWarehouseController";
import {
  formatTransferTypeLabel,
  type InventoryTransferWorkbenchScope,
  type InterwarehouseTransferRow,
} from "@/features/inventory/model/interwarehouse-transfer";
import { InterwarehouseTransferFilters } from "@/features/inventory/view/components/InterwarehouseTransferFilters";
import { CreateTransferOrderPanel } from "@/features/transfers/view/components/CreateTransferOrderPanel";
import { ActionIconButton } from "@/shared/components/action-icon-button/action-icon-button";
import { QueryAlert } from "@/shared/components/query-alert/query-alert";
import { ResourceTable, type ResourceTableColumnDefinition } from "@/shared/components/resource-table";
import { StatusChip } from "@/shared/components/status-chip";
import { formatDateTime } from "@/shared/utils/format";

interface InventoryTransferWorkbenchPageProps {
  scope: InventoryTransferWorkbenchScope;
}

export function InventoryTransferWorkbenchPage({ scope }: InventoryTransferWorkbenchPageProps) {
  const { t } = useI18n();
  const {
    activeBucket,
    allowCreation,
    bucketItems,
    columnVisibilityStorageKey,
    createErrorMessage,
    createSuccessMessage,
    createTransferOrderMutation,
    dataView,
    exportVisibleRows,
    filterOptions,
    hasActiveFilters,
    isCreateDialogOpen,
    closeCreateDialog,
    locationsQuery,
    openCreateDialog,
    pagination,
    queryError,
    refetch,
    resetFilters,
    rows,
    setActiveBucket,
    setSort,
    sorting,
    transferOrdersQuery,
    warehouses,
  } = useInventoryTransferWorkbenchController(scope);
  const isInternalMove = scope === "internal";

  const columns = useMemo<Array<ResourceTableColumnDefinition<InterwarehouseTransferRow>>>(
    () => {
      const baseColumns: Array<ResourceTableColumnDefinition<InterwarehouseTransferRow>> = [
        { header: "Transfer No.", key: "transferNumber", minWidth: 140, nowrap: true, render: (row) => row.transferNumber },
        { header: "Status", key: "status", minWidth: 120, render: (row) => <StatusChip status={row.status} /> },
        {
          header: isInternalMove ? "Warehouse" : "From Warehouse",
          key: "fromWarehouse",
          minWidth: 146,
          render: (row) => row.fromWarehouseName,
        },
      ];

      if (!isInternalMove) {
        baseColumns.push(
          { header: "To Warehouse", key: "toWarehouse", minWidth: 146, render: (row) => row.toWarehouseName },
          {
            header: "Transfer Type",
            key: "transferType",
            minWidth: 148,
            render: (row) => t(formatTransferTypeLabel(row.transferType)),
          },
        );
      }

      baseColumns.push(
        { header: "Transfer Details", key: "transferDetails", minWidth: 172, render: (row) => row.transferDetails },
        { header: "Note", key: "note", minWidth: 148, render: (row) => row.raw.notes || "--" },
        { header: "Appendix", key: "appendix", minWidth: 130, render: (row) => row.raw.reference_code || "--" },
        {
          header: "Create Time",
          key: "createTime",
          minWidth: 166,
          render: (row) => formatDateTime(row.createTime),
          sortKey: "createTime",
        },
        {
          header: "Stock-Out Time",
          key: "stockOutTime",
          minWidth: 166,
          render: (row) => formatDateTime(row.stockOutTime),
          sortKey: "stockOutTime",
        },
        {
          header: "Stock In Time",
          key: "stockInTime",
          minWidth: 166,
          render: (row) => formatDateTime(row.stockInTime),
          sortKey: "stockInTime",
        },
        {
          header: "Cancel Time",
          key: "cancelTime",
          minWidth: 166,
          render: (row) => formatDateTime(row.cancelTime),
          sortKey: "cancelTime",
        },
        { header: "Operation", key: "operation", minWidth: 96, render: () => "--" },
      );

      return baseColumns;
    },
    [isInternalMove, t],
  );

  return (
    <>
      <Stack spacing={isInternalMove ? 1.5 : 2.5}>
        {!isInternalMove ? (
          <Alert severity="info">
            {t(
              "Inter-warehouse Transfer is a visibility-only workspace and shows only movements whose destination warehouse differs from the source warehouse.",
            )}
          </Alert>
        ) : null}
        <QueryAlert message={queryError} />
        {allowCreation && createSuccessMessage ? <Alert severity="success">{createSuccessMessage}</Alert> : null}
        {allowCreation ? <QueryAlert message={createErrorMessage} /> : null}
        <Stack spacing={isInternalMove ? 1.5 : 2.5} sx={{ minWidth: 0 }}>
          <InterwarehouseTransferFilters
            activeBucket={activeBucket}
            bucketItems={bucketItems}
            compact={isInternalMove}
            filters={dataView.filters}
            hasActiveFilters={hasActiveFilters}
            onBucketChange={(value) => setActiveBucket(value)}
            onChange={(key, value) => dataView.updateFilter(String(key), String(value))}
            onReset={resetFilters}
            showToWarehouseFilter={!isInternalMove}
            showTransferTypeFilter={!isInternalMove}
            statusBucketsAriaLabel={t(isInternalMove ? "Internal move status buckets" : "Inter-warehouse transfer status buckets")}
            transferTypes={filterOptions.transferTypes}
            warehouses={warehouses}
          />
          <ResourceTable
            allowHorizontalScroll
            columnVisibility={{ storageKey: columnVisibilityStorageKey }}
            columns={columns}
            compact
            emptyMessage={
              isInternalMove
                ? t("No internal moves match the current workspace filters.")
                : t("No inter-warehouse transfers match the current workspace filters.")
            }
            getRowId={(row) => row.id}
            isLoading={transferOrdersQuery.isLoading || locationsQuery.isLoading}
            pagination={pagination}
            preserveHeaderCase
            rows={rows}
            sorting={{
              direction: sorting.direction,
              onSortChange: (sortKey) =>
                setSort(sortKey as "createTime" | "stockOutTime" | "stockInTime" | "cancelTime"),
              sortKey: sorting.sortKey,
            }}
            toolbar={
              <Stack direction="row" spacing={1}>
                {allowCreation ? (
                  <Button onClick={openCreateDialog} startIcon={<AddRoundedIcon />} variant="contained">
                    {t("New Internal Move")}
                  </Button>
                ) : null}
                <Button onClick={exportVisibleRows} startIcon={<DownloadRoundedIcon />} variant="outlined">
                  {t("Export")}
                </Button>
              </Stack>
            }
            toolbarActions={
              <ActionIconButton onClick={() => void refetch()} title={t("Refresh")} tone="neutral">
                <RefreshRoundedIcon fontSize="small" />
              </ActionIconButton>
            }
          />
        </Stack>
      </Stack>
      {allowCreation ? (
        <Dialog fullWidth maxWidth="lg" onClose={closeCreateDialog} open={isCreateDialogOpen}>
          <DialogTitle>{t("New Internal Move")}</DialogTitle>
          <Divider />
          <DialogContent sx={{ pt: 3 }}>
            <CreateTransferOrderPanel
              description={t("Plan same-warehouse inventory relocations from source balances to destination locations.")}
              errorMessage={createErrorMessage}
              isPending={createTransferOrderMutation.isPending}
              onSubmit={(values, balancesById) =>
                createTransferOrderMutation.mutateAsync({ balancesById, values })
              }
              submitLabel={t("Create internal move")}
              submittingLabel={t("Creating internal move...")}
              successMessage={null}
              title={t("Create internal move")}
            />
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
