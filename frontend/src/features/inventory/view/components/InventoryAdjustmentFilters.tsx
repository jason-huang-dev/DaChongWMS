import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { InputAdornment, MenuItem, Stack, TextField } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import type { DataViewFilters } from "@/shared/hooks/use-data-view";
import { useI18n } from "@/app/ui-preferences";
import { RangePicker } from "@/shared/components/range-picker";
import type { WarehouseRecord } from "@/shared/types/domain";

export interface InventoryAdjustmentViewFilters extends DataViewFilters {
  adjustmentType: string;
  dateFrom: string;
  dateTo: string;
  matchMode: string;
  searchField: string;
  searchText: string;
}

interface InventoryAdjustmentFiltersProps {
  filters: InventoryAdjustmentViewFilters;
  onChange: (key: keyof InventoryAdjustmentViewFilters & string, value: string) => void;
  onWarehouseChange: (warehouseId: number) => void;
  warehouseId: number | null;
  warehouses: WarehouseRecord[];
}

const searchFieldOptions = [
  { label: "Merchant SKU", value: "merchantSku" },
  { label: "Adjustment No.", value: "referenceCode" },
  { label: "Shelf", value: "locationCode" },
  { label: "Operator", value: "performedBy" },
  { label: "Search all", value: "query" },
] as const;

export function InventoryAdjustmentFilters({
  filters,
  onChange,
  onWarehouseChange,
  warehouseId,
  warehouses,
}: InventoryAdjustmentFiltersProps) {
  const theme = useTheme();
  const { translateText } = useI18n();
  const isDark = theme.palette.mode === "dark";
  const filterControlSx = {
    "& .MuiInputBase-input": {
      fontSize: theme.typography.body2.fontSize,
      py: 0.95,
    },
    "& .MuiOutlinedInput-root": {
      backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.54 : 0.98),
      borderRadius: 2,
      minHeight: 42,
    },
  } as const;

  return (
    <Stack
      alignItems={{ md: "center", xs: "stretch" }}
      direction={{ md: "row", xs: "column" }}
      spacing={1}
      sx={{ minWidth: 0 }}
    >
      <TextField
        hiddenLabel
        onChange={(event) => onWarehouseChange(Number(event.target.value))}
        select
        size="small"
        SelectProps={{
          displayEmpty: true,
          SelectDisplayProps: { "aria-label": translateText("Warehouse") },
        }}
        sx={{ ...filterControlSx, flex: "0 0 160px" }}
        value={warehouseId ?? ""}
      >
        {warehouses.map((warehouse) => (
          <MenuItem key={warehouse.id} value={warehouse.id}>
            {warehouse.warehouse_name}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        hiddenLabel
        onChange={(event) => onChange("adjustmentType", event.target.value)}
        select
        size="small"
        SelectProps={{
          displayEmpty: true,
          SelectDisplayProps: { "aria-label": translateText("Adjustment type") },
        }}
        sx={{ ...filterControlSx, flex: "0 0 220px" }}
        value={filters.adjustmentType}
      >
        <MenuItem value="">{translateText("All Adjustment Types")}</MenuItem>
        <MenuItem value="ADJUSTMENT_OUT">{translateText("Adjustment Out")}</MenuItem>
        <MenuItem value="ADJUSTMENT_IN">{translateText("Adjustment In")}</MenuItem>
      </TextField>
      <RangePicker
        endAriaLabel={translateText("Adjustment date to")}
        endValue={filters.dateTo}
        fieldSx={{
          ...filterControlSx,
          minWidth: { md: 156, xs: "100%" },
          width: { md: 156 },
        }}
        inputType="date"
        onEndChange={(value) => onChange("dateTo", value)}
        onStartChange={(value) => onChange("dateFrom", value)}
        rootSx={{ flex: "0 0 auto" }}
        startAriaLabel={translateText("Adjustment date from")}
        startValue={filters.dateFrom}
      />
      <TextField
        hiddenLabel
        onChange={(event) => onChange("searchField", event.target.value)}
        select
        size="small"
        SelectProps={{
          displayEmpty: true,
          SelectDisplayProps: { "aria-label": translateText("Adjustment search field") },
        }}
        sx={{ ...filterControlSx, flex: "0 0 172px" }}
        value={filters.searchField}
      >
        {searchFieldOptions.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {translateText(option.label)}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        hiddenLabel
        onChange={(event) => onChange("searchText", event.target.value)}
        placeholder={translateText("Search content")}
        size="small"
        slotProps={{
          htmlInput: {
            "aria-label": translateText("Adjustment search text"),
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
        sx={{ ...filterControlSx, flex: "1 1 280px", minWidth: 220 }}
        value={filters.searchText}
      />
      <TextField
        hiddenLabel
        onChange={(event) => onChange("matchMode", event.target.value === "contains" ? "" : event.target.value)}
        select
        size="small"
        SelectProps={{
          displayEmpty: true,
          SelectDisplayProps: { "aria-label": translateText("Adjustment match mode") },
        }}
        sx={{ ...filterControlSx, flex: "0 0 164px" }}
        value={filters.matchMode || "contains"}
      >
        <MenuItem value="contains">{translateText("Contains")}</MenuItem>
        <MenuItem value="exact">{translateText("Exact")}</MenuItem>
      </TextField>
    </Stack>
  );
}
