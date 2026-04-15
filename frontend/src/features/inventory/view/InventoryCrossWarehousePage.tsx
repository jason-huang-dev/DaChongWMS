import { useMemo } from "react";

import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
} from "@mui/material";

import { useI18n } from "@/app/ui-preferences";
import { useInventoryCrossWarehouseController } from "@/features/inventory/controller/useInventoryCrossWarehouseController";
import {
  formatTransferTypeLabel,
  type InterwarehouseTransferRow,
} from "@/features/inventory/model/interwarehouse-transfer";
import { InterwarehouseTransferFilters } from "@/features/inventory/view/components/InterwarehouseTransferFilters";
import { CreateTransferOrderPanel } from "@/features/transfers/view/components/CreateTransferOrderPanel";
import { ActionIconButton } from "@/shared/components/action-icon-button/action-icon-button";
import { QueryAlert } from "@/shared/components/query-alert/query-alert";
import { ResourceTable, type ResourceTableColumnDefinition } from "@/shared/components/resource-table";
import { StatusChip } from "@/shared/components/status-chip";
import { formatDateTime } from "@/shared/utils/format";

export function InventoryCrossWarehousePage() {
  const { t } = useI18n();
  const {
    activeBucket,
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
    openCreateDialog,
    closeCreateDialog,
    locationsQuery,
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
  } = useInventoryCrossWarehouseController();
  const columns = useMemo<Array<ResourceTableColumnDefinition<InterwarehouseTransferRow>>>(
    () => [
      { header: "Transfer No.", key: "transferNumber", minWidth: 140, nowrap: true, render: (row) => row.transferNumber },
      { header: "Status", key: "status", minWidth: 120, render: (row) => <StatusChip status={row.status} /> },
      { header: "From Warehouse", key: "fromWarehouse", minWidth: 146, render: (row) => row.fromWarehouseName },
      { header: "To Warehouse", key: "toWarehouse", minWidth: 146, render: (row) => row.toWarehouseName },
      {
        header: "Transfer Type",
        key: "transferType",
        minWidth: 148,
        render: (row) => t(formatTransferTypeLabel(row.transferType)),
      },
      { header: "Transfer Details", key: "transferDetails", minWidth: 172, render: (row) => row.transferDetails },
      { header: "Note", key: "note", minWidth: 148, render: (row) => row.raw.notes || "--" },
      { header: "Appendix", key: "appendix", minWidth: 130, render: (row) => row.raw.reference_code || "--" },
      { header: "Creator", key: "creator", minWidth: 100, render: () => "--" },
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
    ],
    [t],
  );

  return (
    <>
      <Stack spacing={2.5}>
        <Alert severity="info">
          {t(
            "Destination warehouses are inferred from destination locations for now. The page matches the new queue-style workspace while the backend is still converging on a dedicated cross-warehouse transfer object.",
          )}
        </Alert>
        <QueryAlert message={queryError} />
        {createSuccessMessage ? <Alert severity="success">{createSuccessMessage}</Alert> : null}
        <QueryAlert message={createErrorMessage} />
        <Stack spacing={2.5} sx={{ minWidth: 0 }}>
          <InterwarehouseTransferFilters
            activeBucket={activeBucket}
            activeFilterCount={dataView.activeFilterCount}
            bucketItems={bucketItems}
            filters={dataView.filters}
            hasActiveFilters={hasActiveFilters}
            onBucketChange={(value) => setActiveBucket(value)}
            onChange={(key, value) => dataView.updateFilter(key, String(value))}
            onReset={resetFilters}
            transferTypes={filterOptions.transferTypes}
            warehouses={warehouses}
          />
          <ResourceTable
            allowHorizontalScroll
            columnVisibility={{ storageKey: columnVisibilityStorageKey }}
            columns={columns}
            compact
            emptyMessage="No transfer orders match the current workspace filters."
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
              <Stack direction="row" spacing={1.5}>
                <Button onClick={openCreateDialog} startIcon={<AddRoundedIcon />} variant="contained">
                  {t("New Transfer")}
                </Button>
                <Button disabled startIcon={<UploadFileRoundedIcon />} variant="outlined">
                  {t("Import")}
                </Button>
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
      <Dialog fullWidth maxWidth="lg" onClose={closeCreateDialog} open={isCreateDialogOpen}>
        <DialogTitle>{t("New Transfer")}</DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 3 }}>
          <CreateTransferOrderPanel
            errorMessage={createErrorMessage}
            isPending={createTransferOrderMutation.isPending}
            onSubmit={(values, balancesById) =>
              createTransferOrderMutation.mutateAsync({ balancesById, values })
            }
            successMessage={null}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
