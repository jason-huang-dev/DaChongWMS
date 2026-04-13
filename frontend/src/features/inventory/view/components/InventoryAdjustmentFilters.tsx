import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { InputAdornment, MenuItem, Stack, TextField } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import type { DataViewFilters } from "@/shared/hooks/use-data-view";
import { useI18n } from "@/app/ui-preferences";
import { FieldSelectorFilter } from "@/shared/components/field-selector-filter";
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
  const { t, translate, msg } = useI18n();
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
    <Stack spacing={0.75} sx={{ minWidth: 0 }}>
      <Stack
        alignItems={{ md: "center", xs: "stretch" }}
        data-adjustment-filter-row="primary"
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
            SelectDisplayProps: { "aria-label": t("Warehouse") },
          }}
          sx={{ ...filterControlSx, flex: { md: "0 0 240px", xs: "1 1 auto" }, minWidth: 0 }}
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
            SelectDisplayProps: { "aria-label": t("Adjustment type") },
          }}
          sx={{ ...filterControlSx, flex: { md: "0 0 248px", xs: "1 1 auto" }, minWidth: 0 }}
          value={filters.adjustmentType}
        >
          <MenuItem value="">{t("All Adjustment Types")}</MenuItem>
          <MenuItem value="ADJUSTMENT_OUT">{t("Adjustment Out")}</MenuItem>
          <MenuItem value="ADJUSTMENT_IN">{t("Adjustment In")}</MenuItem>
        </TextField>
        <RangePicker
          endAriaLabel={t("Adjustment date to")}
          endValue={filters.dateTo}
          fieldSx={{
            ...filterControlSx,
            minWidth: { md: 156, xs: "100%" },
            width: { md: 156 },
          }}
          inputType="date"
          onEndChange={(value) => onChange("dateTo", value)}
          onStartChange={(value) => onChange("dateFrom", value)}
          rootSx={{
            flex: { md: "1 1 360px", xs: "1 1 auto" },
            minWidth: 0,
            width: "100%",
          }}
          startAriaLabel={t("Adjustment date from")}
          startValue={filters.dateFrom}
        />
      </Stack>
      <Stack
        alignItems={{ md: "center", xs: "stretch" }}
        data-adjustment-filter-row="search"
        direction={{ md: "row", xs: "column" }}
        spacing={1}
        sx={{ minWidth: 0 }}
      >
        <FieldSelectorFilter sx={{ flex: "1 1 auto", minWidth: 0 }}>
          <TextField
            hiddenLabel
            onChange={(event) => onChange("searchField", event.target.value)}
            select
            size="small"
            SelectProps={{
              displayEmpty: true,
              SelectDisplayProps: { "aria-label": t("Adjustment search field") },
            }}
            sx={{ ...filterControlSx, flex: { md: "0 0 240px", xs: "1 1 auto" }, minWidth: 0 }}
            value={filters.searchField}
          >
            {searchFieldOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {translate(option.label)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            hiddenLabel
            onChange={(event) => onChange("searchText", event.target.value)}
            placeholder={t("Search content")}
            size="small"
            slotProps={{
              htmlInput: {
                "aria-label": t("Adjustment search text"),
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
            sx={{ ...filterControlSx, flex: "1 1 260px", minWidth: 0 }}
            value={filters.searchText}
          />
        </FieldSelectorFilter>
        <TextField
          hiddenLabel
          onChange={(event) => onChange("matchMode", event.target.value === "contains" ? "" : event.target.value)}
          select
          size="small"
          SelectProps={{
            displayEmpty: true,
            SelectDisplayProps: { "aria-label": t("Adjustment match mode") },
          }}
          sx={{ ...filterControlSx, flex: { md: "0 0 180px", xs: "1 1 auto" }, minWidth: 0 }}
          value={filters.matchMode || "contains"}
        >
          <MenuItem value="contains">{t("Contains")}</MenuItem>
          <MenuItem value="exact">{t("Exact")}</MenuItem>
        </TextField>
      </Stack>
    </Stack>
  );
}
