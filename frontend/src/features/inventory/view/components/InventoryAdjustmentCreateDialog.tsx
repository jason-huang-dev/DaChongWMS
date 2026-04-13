import { useEffect, useMemo, useState } from "react";

import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogTitle,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useQuery } from "@tanstack/react-query";

import { useI18n } from "@/app/ui-preferences";
import { inventoryApi } from "@/features/inventory/model/api";
import type {
  InventoryAdjustmentLineMovementType,
  InventoryAdjustmentListValues,
} from "@/features/inventory/model/types";
import { ActionIconButton } from "@/shared/components/action-icon-button";
import {
  DataTable,
  type DataTableColumnDefinition,
  type DataTableRowSelection,
} from "@/shared/components/data-table";
import { parseApiError } from "@/shared/utils/parse-api-error";
import { formatNumber } from "@/shared/utils/format";
import { apiGet } from "@/lib/http";
import type { PaginatedResponse } from "@/shared/types/api";
import type { InventoryBalanceRecord, WarehouseRecord } from "@/shared/types/domain";

const pickerPageSize = 8;
const adjustmentTypeOptions = [
  { label: "Good Product Adjustment", value: "Good Product Adjustment" },
] as const;
const lineMovementTypeOptions: Array<{
  label: string;
  value: InventoryAdjustmentLineMovementType;
}> = [
  { label: "Increase", value: "ADJUSTMENT_IN" },
  { label: "Reduce", value: "ADJUSTMENT_OUT" },
] as const;

interface InventoryAdjustmentDraftLine {
  id: string;
  availableQty: string;
  balanceId: number;
  goodsCode: string;
  locationCode: string;
  lotNumber: string;
  movementType: InventoryAdjustmentLineMovementType;
  quantity: string;
  serialNumber: string;
  stockStatus: string;
}

interface InventoryAdjustmentCreateDialogProps {
  errorMessage?: string | null;
  initialWarehouseId: number | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: InventoryAdjustmentListValues) => Promise<unknown> | unknown;
  open: boolean;
  warehouses: WarehouseRecord[];
}

function getDefaultWarehouseId(initialWarehouseId: number | null, warehouses: WarehouseRecord[]) {
  if (initialWarehouseId && warehouses.some((warehouse) => warehouse.id === initialWarehouseId)) {
    return initialWarehouseId;
  }
  return warehouses[0]?.id ?? null;
}

function paginateRows<TItem>(rows: TItem[], page: number, pageSize: number) {
  const start = Math.max(page - 1, 0) * pageSize;
  return rows.slice(start, start + pageSize);
}

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase();
}

function buildDraftLine(balance: InventoryBalanceRecord): InventoryAdjustmentDraftLine {
  return {
    id: `balance-${balance.id}`,
    availableQty: balance.available_qty,
    balanceId: balance.id,
    goodsCode: balance.goods_code,
    locationCode: balance.location_code,
    lotNumber: balance.lot_number,
    movementType: "ADJUSTMENT_OUT",
    quantity: "",
    serialNumber: balance.serial_number,
    stockStatus: balance.stock_status,
  };
}

function filterBalances(rows: InventoryBalanceRecord[], searchText: string) {
  const normalizedSearchText = normalizeSearchValue(searchText);
  if (!normalizedSearchText) {
    return rows;
  }

  return rows.filter((row) =>
    [
      row.goods_code,
      row.location_code,
      row.lot_number,
      row.serial_number,
      row.stock_status,
    ]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(normalizedSearchText)),
  );
}

function buildAdjustmentReasonLength(adjustmentType: string, note: string) {
  const trimmedAdjustmentType = adjustmentType.trim();
  const trimmedNote = note.trim();

  return trimmedNote ? `${trimmedAdjustmentType}: ${trimmedNote}`.length : trimmedAdjustmentType.length;
}

function parseQuantity(value: string) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : NaN;
}

function getLineValidationMessage(
  line: InventoryAdjustmentDraftLine,
  t: (key: string, params?: Record<string, string | number | null | undefined>) => string,
) {
  const quantity = parseQuantity(line.quantity);

  if (!line.quantity.trim() || !Number.isFinite(quantity) || quantity <= 0) {
    return t("Quantity must be greater than zero.");
  }

  if (line.movementType === "ADJUSTMENT_OUT" && quantity > Number(line.availableQty)) {
    return t("Reduce quantity cannot exceed available stock.");
  }

  return null;
}

async function fetchAllInventoryBalances(warehouseId: number) {
  let page = 1;
  const rows: InventoryBalanceRecord[] = [];

  while (true) {
    const response = await apiGet<PaginatedResponse<InventoryBalanceRecord>>(inventoryApi.balances, {
      page,
      page_size: 200,
      warehouse: warehouseId,
    });

    rows.push(...response.results);
    if (!response.next || rows.length >= response.count) {
      break;
    }
    page += 1;
  }

  return rows;
}

export function InventoryAdjustmentCreateDialog({
  errorMessage,
  initialWarehouseId,
  isSubmitting,
  onClose,
  onSubmit,
  open,
  warehouses,
}: InventoryAdjustmentCreateDialogProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t, translate, msg } = useI18n();
  const [warehouseId, setWarehouseId] = useState<number | null>(getDefaultWarehouseId(initialWarehouseId, warehouses));
  const [adjustmentType, setAdjustmentType] = useState<string>(adjustmentTypeOptions[0]?.value ?? "");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<InventoryAdjustmentDraftLine[]>([]);
  const [localErrorMessage, setLocalErrorMessage] = useState<string | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerSearchText, setPickerSearchText] = useState("");
  const [pickerPage, setPickerPage] = useState(1);
  const [pickerSelectedBalanceIds, setPickerSelectedBalanceIds] = useState<number[]>([]);
  const [isBatchDialogOpen, setIsBatchDialogOpen] = useState(false);
  const [batchMovementType, setBatchMovementType] = useState<InventoryAdjustmentLineMovementType>("ADJUSTMENT_OUT");
  const [batchQuantity, setBatchQuantity] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    setWarehouseId(getDefaultWarehouseId(initialWarehouseId, warehouses));
    setAdjustmentType(adjustmentTypeOptions[0]?.value ?? "");
    setNote("");
    setLines([]);
    setLocalErrorMessage(null);
    setIsPickerOpen(false);
    setPickerSearchText("");
    setPickerPage(1);
    setPickerSelectedBalanceIds([]);
    setIsBatchDialogOpen(false);
    setBatchMovementType("ADJUSTMENT_OUT");
    setBatchQuantity("");
  }, [initialWarehouseId, open, warehouses]);

  const balanceQuery = useQuery({
    queryKey: ["inventory", "adjustment-create", "balances", warehouseId ?? "none"],
    queryFn: () => fetchAllInventoryBalances(warehouseId ?? 0),
    enabled: open && Boolean(warehouseId),
  });

  const filteredBalances = useMemo(
    () => filterBalances(balanceQuery.data ?? [], pickerSearchText),
    [balanceQuery.data, pickerSearchText],
  );
  const pagedBalances = useMemo(
    () => paginateRows(filteredBalances, pickerPage, pickerPageSize),
    [filteredBalances, pickerPage],
  );

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filteredBalances.length / pickerPageSize));
    if (pickerPage > maxPage) {
      setPickerPage(maxPage);
    }
  }, [filteredBalances.length, pickerPage]);

  const updateLine = (lineId: string, updates: Partial<InventoryAdjustmentDraftLine>) => {
    setLines((currentLines) =>
      currentLines.map((line) => (line.id === lineId ? { ...line, ...updates } : line)),
    );
    setLocalErrorMessage(null);
  };

  const removeLine = (lineId: string) => {
    setLines((currentLines) => currentLines.filter((line) => line.id !== lineId));
    setLocalErrorMessage(null);
  };

  const lineColumns = useMemo<
    Array<DataTableColumnDefinition<InventoryAdjustmentDraftLine>>
  >(
    () => [
      {
        header: "Product Info",
        key: "productInfo",
        minWidth: 250,
        render: (line) => (
          <Stack spacing={0.35} sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800, overflowWrap: "anywhere" }} variant="body2">
              {line.goodsCode}
            </Typography>
            <Typography color="text.secondary" sx={{ overflowWrap: "anywhere" }} variant="caption">
              {[line.stockStatus, line.lotNumber || line.serialNumber].filter(Boolean).join(" / ") || "--"}
            </Typography>
          </Stack>
        ),
        width: "28%",
      },
      {
        header: "Shelf",
        key: "shelf",
        minWidth: 150,
        render: (line) => (
          <TextField
            disabled
            size="small"
            value={line.locationCode}
            sx={{
              minWidth: 150,
              "& .MuiOutlinedInput-root": {
                backgroundColor: alpha(theme.palette.background.default, isDark ? 0.2 : 0.36),
              },
            }}
          />
        ),
        width: "18%",
      },
      {
        align: "right",
        header: "Available Stock",
        key: "availableStock",
        minWidth: 120,
        render: (line) => (
          <Typography sx={{ fontWeight: 700 }} variant="body2">
            {formatNumber(Number(line.availableQty))}
          </Typography>
        ),
        width: "12%",
      },
      {
        header: "Adjustment Qty",
        key: "adjustmentQty",
        minWidth: 240,
        render: (line) => {
          const validationMessage = getLineValidationMessage(line, t);

          return (
            <Stack spacing={0.5}>
              <Stack direction={{ md: "row", xs: "column" }} spacing={1}>
                <TextField
                  onChange={(event) =>
                    updateLine(line.id, {
                      movementType: event.target.value as InventoryAdjustmentLineMovementType,
                    })
                  }
                  select
                  size="small"
                  value={line.movementType}
                  SelectProps={{
                    displayEmpty: true,
                    SelectDisplayProps: {
                      "aria-label": t("inventory.adjustmentDirectionFor", { goodsCode: line.goodsCode }),
                    },
                  }}
                  sx={{ flex: "0 0 124px", minWidth: 124 }}
                >
                  {lineMovementTypeOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {translate(option.label)}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  error={Boolean(validationMessage)}
                  onChange={(event) => updateLine(line.id, { quantity: event.target.value })}
                  placeholder={t("Please enter")}
                  size="small"
                  slotProps={{
                    htmlInput: {
                      "aria-label": t("inventory.adjustmentQuantityFor", { goodsCode: line.goodsCode }),
                      inputMode: "decimal",
                      min: 0,
                      step: "0.0001",
                    },
                  }}
                  type="number"
                  value={line.quantity}
                />
              </Stack>
              {validationMessage ? (
                <Typography color="error.main" variant="caption">
                  {validationMessage}
                </Typography>
              ) : null}
            </Stack>
          );
        },
        width: "30%",
      },
      {
        align: "center",
        header: "Operation",
        key: "operation",
        minWidth: 80,
        render: (line) => (
          <ActionIconButton
            aria-label={t("inventory.removeProductFor", { goodsCode: line.goodsCode })}
            onClick={() => removeLine(line.id)}
            title={t("Remove product")}
          >
            <DeleteOutlineRoundedIcon fontSize="small" />
          </ActionIconButton>
        ),
        width: "12%",
      },
    ],
    [isDark, t, theme],
  );

  const pickerColumns = useMemo<Array<DataTableColumnDefinition<InventoryBalanceRecord>>>(
    () => [
      {
        header: "Product Info",
        key: "productInfo",
        minWidth: 240,
        render: (row) => (
          <Stack spacing={0.35} sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800, overflowWrap: "anywhere" }} variant="body2">
              {row.goods_code}
            </Typography>
            <Typography color="text.secondary" variant="caption">
              {[row.stock_status, row.lot_number || row.serial_number].filter(Boolean).join(" / ") || "--"}
            </Typography>
          </Stack>
        ),
        width: "38%",
      },
      {
        header: "Shelf",
        key: "shelf",
        minWidth: 150,
        render: (row) => row.location_code,
        width: "22%",
      },
      {
        align: "right",
        header: "Available Stock",
        key: "availableStock",
        minWidth: 120,
        render: (row) => formatNumber(Number(row.available_qty)),
        width: "18%",
      },
      {
        header: "Stock Status",
        key: "stockStatus",
        minWidth: 120,
        render: (row) => row.stock_status,
        width: "22%",
      },
    ],
    [],
  );

  const pickerRowSelection = useMemo<DataTableRowSelection<InventoryBalanceRecord>>(
    () => ({
      selectedRowIds: pickerSelectedBalanceIds,
      onToggleAll: (rows) =>
        setPickerSelectedBalanceIds((currentSelectedBalanceIds) => {
          const rowIds = rows.map((row) => row.id);
          const allRowsSelected =
            rowIds.length > 0 && rowIds.every((rowId) => currentSelectedBalanceIds.includes(rowId));
          if (allRowsSelected) {
            return currentSelectedBalanceIds.filter((rowId) => !rowIds.includes(rowId));
          }
          return Array.from(new Set([...currentSelectedBalanceIds, ...rowIds]));
        }),
      onToggleRow: (row) =>
        setPickerSelectedBalanceIds((currentSelectedBalanceIds) =>
          currentSelectedBalanceIds.includes(row.id)
            ? currentSelectedBalanceIds.filter((rowId) => rowId !== row.id)
            : [...currentSelectedBalanceIds, row.id],
        ),
    }),
    [pickerSelectedBalanceIds],
  );

  const handleConfirmSelectedProducts = () => {
    const selectedBalances = (balanceQuery.data ?? []).filter((balance) =>
      pickerSelectedBalanceIds.includes(balance.id),
    );
    if (selectedBalances.length === 0) {
      setLocalErrorMessage(t("Select at least one product."));
      return;
    }

    setLines((currentLines) => {
      const existingBalanceIds = new Set(currentLines.map((line) => line.balanceId));
      const nextLines = selectedBalances
        .filter((balance) => !existingBalanceIds.has(balance.id))
        .map((balance) => buildDraftLine(balance));
      return [...currentLines, ...nextLines];
    });
    setIsPickerOpen(false);
    setPickerSelectedBalanceIds([]);
    setPickerSearchText("");
    setPickerPage(1);
    setLocalErrorMessage(null);
  };

  const handleApplyBatchValues = () => {
    const parsedQuantity = parseQuantity(batchQuantity);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setLocalErrorMessage(t("Quantity must be greater than zero."));
      return;
    }

    setLines((currentLines) =>
      currentLines.map((line) => ({
        ...line,
        movementType: batchMovementType,
        quantity: String(parsedQuantity),
      })),
    );
    setIsBatchDialogOpen(false);
    setBatchQuantity("");
    setLocalErrorMessage(null);
  };

  const handleSubmit = async () => {
    if (!warehouseId) {
      setLocalErrorMessage(t("Warehouse is required."));
      return;
    }
    if (!adjustmentType.trim()) {
      setLocalErrorMessage(t("Adjustment type is required."));
      return;
    }
    if (lines.length === 0) {
      setLocalErrorMessage(t("Select at least one product."));
      return;
    }
    if (buildAdjustmentReasonLength(adjustmentType, note) > 255) {
      setLocalErrorMessage(
        t("Adjustment note must be 255 characters or less once combined with adjustment type."),
      );
      return;
    }

    const invalidLine = lines.find((line) => getLineValidationMessage(line, t));
    if (invalidLine) {
      setLocalErrorMessage(getLineValidationMessage(invalidLine, t));
      return;
    }

    setLocalErrorMessage(null);
    await onSubmit({
      warehouseId,
      adjustmentType: adjustmentType.trim(),
      note: note.trim(),
      items: lines.map((line) => ({
        balanceId: line.balanceId,
        movementType: line.movementType,
        quantity: Number(line.quantity),
      })),
    });
  };

  const sectionCardSx = {
    border: `1px solid ${alpha(theme.palette.divider, isDark ? 0.46 : 0.76)}`,
    borderRadius: 3,
    boxShadow: "none",
  } as const;

  return (
    <>
      <Dialog fullWidth maxWidth="xl" onClose={isSubmitting ? undefined : onClose} open={open}>
        <DialogTitle sx={{ pb: 1.5 }}>
          <Stack
            alignItems={{ md: "center" }}
            direction={{ md: "row", xs: "column" }}
            justifyContent="space-between"
            spacing={1.5}
          >
            <Typography sx={{ fontWeight: 800 }} variant="h5">
              {t("Create Adjustment List")}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button color="inherit" disabled={isSubmitting} onClick={onClose} variant="outlined">
                {t("Cancel")}
              </Button>
              <Button disabled={isSubmitting} onClick={() => void handleSubmit()} variant="contained">
                {isSubmitting ? t("Submitting...") : t("Confirm the Adjustment")}
              </Button>
            </Stack>
          </Stack>
        </DialogTitle>
        <DialogContent dividers sx={{ pb: 3, pt: 2.5 }}>
          <Stack spacing={2.5}>
            {localErrorMessage ? <Alert severity="error">{localErrorMessage}</Alert> : null}
            {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
            <Card sx={sectionCardSx}>
              <CardContent>
                <Stack spacing={2.25}>
                  <Box
                    sx={{
                      display: "grid",
                      gap: 2,
                      gridTemplateColumns: {
                        md: "minmax(0, 220px) minmax(0, 220px)",
                        xs: "minmax(0, 1fr)",
                      },
                    }}
                  >
                    <TextField
                      label={t("Warehouse")}
                      onChange={(event) => {
                        const nextWarehouseId = Number(event.target.value);
                        setWarehouseId(Number.isFinite(nextWarehouseId) ? nextWarehouseId : null);
                        setLines([]);
                        setPickerSelectedBalanceIds([]);
                        setPickerSearchText("");
                        setPickerPage(1);
                        setLocalErrorMessage(null);
                      }}
                      select
                      size="small"
                      value={warehouseId ?? ""}
                      SelectProps={{
                        displayEmpty: true,
                        SelectDisplayProps: { "aria-label": t("Warehouse") },
                      }}
                    >
                      {warehouses.map((warehouse) => (
                        <MenuItem key={warehouse.id} value={warehouse.id}>
                          {warehouse.warehouse_name}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      label={t("Adjustment Type")}
                      onChange={(event) => {
                        setAdjustmentType(event.target.value);
                        setLocalErrorMessage(null);
                      }}
                      select
                      size="small"
                      value={adjustmentType}
                      SelectProps={{
                        displayEmpty: true,
                        SelectDisplayProps: { "aria-label": t("Adjustment Type") },
                      }}
                    >
                      {adjustmentTypeOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {translate(option.label)}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Box>
                  <TextField
                    label={t("Note")}
                    multiline
                    minRows={4}
                    onChange={(event) => {
                      setNote(event.target.value);
                      setLocalErrorMessage(null);
                    }}
                    placeholder={t("Please enter")}
                    slotProps={{
                      formHelperText: { sx: { textAlign: "right" } },
                      htmlInput: {
                        "aria-label": t("Adjustment note"),
                        maxLength: 255,
                      },
                    }}
                    helperText={`${note.length}/255`}
                    value={note}
                  />
                </Stack>
              </CardContent>
            </Card>

            <DataTable
              columns={lineColumns}
              emptyMessage="No products selected yet."
              fillHeight={false}
              getRowId={(line) => line.id}
              rows={lines}
              stickyHeader={false}
              toolbar={
                <Stack
                  alignItems={{ md: "center" }}
                  direction={{ md: "row", xs: "column" }}
                  justifyContent="space-between"
                  spacing={1}
                >
                  <Typography color="text.secondary" variant="body2">
                    {t("bulk.selectedCount", { count: lines.length })}
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Button disabled={lines.length === 0} onClick={() => setIsBatchDialogOpen(true)} variant="outlined">
                      {t("Batch Add Products")}
                    </Button>
                    <Button
                      disabled={!warehouseId || balanceQuery.isLoading}
                      onClick={() => {
                        setIsPickerOpen(true);
                        setPickerSelectedBalanceIds([]);
                        setPickerSearchText("");
                        setPickerPage(1);
                        setLocalErrorMessage(null);
                      }}
                      variant="outlined"
                    >
                      {t("Select Products")}
                    </Button>
                  </Stack>
                </Stack>
              }
              toolbarPlacement="inner"
            />
          </Stack>
        </DialogContent>
      </Dialog>

      <Dialog
        fullWidth
        maxWidth="lg"
        onClose={() => setIsPickerOpen(false)}
        open={open && isPickerOpen}
      >
        <DialogTitle>{t("Select Products")}</DialogTitle>
        <DialogContent dividers sx={{ pb: 2.5, pt: 2.5 }}>
          <Stack spacing={2}>
            <TextField
              onChange={(event) => {
                setPickerSearchText(event.target.value);
                setPickerPage(1);
              }}
              placeholder={t("Search SKU or shelf")}
              size="small"
              slotProps={{
                htmlInput: {
                  "aria-label": t("Product search"),
                },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRoundedIcon color="action" fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
              value={pickerSearchText}
            />
            <DataTable
              columns={pickerColumns}
              emptyMessage="No inventory positions match the current search."
              error={balanceQuery.error ? parseApiError(balanceQuery.error) : null}
              getRowId={(row) => row.id}
              isLoading={balanceQuery.isLoading}
              pagination={{
                page: pickerPage,
                pageSize: pickerPageSize,
                total: filteredBalances.length,
                onPageChange: setPickerPage,
              }}
              rowSelection={pickerRowSelection}
              rows={pagedBalances}
              toolbar={
                <Stack direction="row" justifyContent="space-between" spacing={1}>
                  <Typography color="text.secondary" variant="body2">
                    {t("bulk.selectedCount", { count: pickerSelectedBalanceIds.length })}
                  </Typography>
                  <Button
                    disabled={pickerSelectedBalanceIds.length === 0}
                    onClick={handleConfirmSelectedProducts}
                    variant="contained"
                  >
                    {t("Add selected products")}
                  </Button>
                </Stack>
              }
              toolbarPlacement="inner"
            />
          </Stack>
        </DialogContent>
      </Dialog>

      <Dialog
        fullWidth
        maxWidth="sm"
        onClose={() => setIsBatchDialogOpen(false)}
        open={open && isBatchDialogOpen}
      >
        <DialogTitle>{t("Batch Add Products")}</DialogTitle>
        <DialogContent dividers sx={{ pb: 2.5, pt: 2.5 }}>
          <Stack spacing={2}>
            <TextField
              label={t("Adjustment direction")}
              onChange={(event) => setBatchMovementType(event.target.value as InventoryAdjustmentLineMovementType)}
              select
              size="small"
              value={batchMovementType}
            >
              {lineMovementTypeOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {translate(option.label)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label={t("Adjustment Qty")}
              onChange={(event) => setBatchQuantity(event.target.value)}
              size="small"
              slotProps={{
                htmlInput: {
                  "aria-label": t("Batch adjustment quantity"),
                  inputMode: "decimal",
                  min: 0,
                  step: "0.0001",
                },
              }}
              type="number"
              value={batchQuantity}
            />
            <Stack direction="row" justifyContent="flex-end" spacing={1}>
              <Button color="inherit" onClick={() => setIsBatchDialogOpen(false)}>
                {t("Cancel")}
              </Button>
              <Button onClick={handleApplyBatchValues} variant="contained">
                {t("Apply to all rows")}
              </Button>
            </Stack>
          </Stack>
        </DialogContent>
      </Dialog>
    </>
  );
}
