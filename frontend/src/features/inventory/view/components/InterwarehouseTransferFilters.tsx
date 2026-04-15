import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { Box, Button, Grid, InputAdornment, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

import { useI18n } from "@/app/ui-preferences";
import { FilterCard } from "@/shared/components/filter-card/filter-card";
import { PageTabs } from "@/shared/components/page-tabs";
import { RangePicker } from "@/shared/components/range-picker/range-picker";

import type {
  InterwarehouseTransferBucket,
  InterwarehouseTransferFilters,
} from "@/features/inventory/model/interwarehouse-transfer";
import type { WarehouseRecord } from "@/shared/types/domain";

interface InterwarehouseTransferFiltersProps {
  activeBucket: InterwarehouseTransferBucket;
  activeFilterCount: number;
  bucketItems: ReadonlyArray<{ count?: number | string; label: string; value: InterwarehouseTransferBucket }>;
  filters: InterwarehouseTransferFilters;
  hasActiveFilters: boolean;
  onChange: <TKey extends keyof InterwarehouseTransferFilters>(
    key: TKey,
    value: InterwarehouseTransferFilters[TKey],
  ) => void;
  onBucketChange: (value: InterwarehouseTransferBucket) => void;
  onReset: () => void;
  transferTypes: ReadonlyArray<{ label: string; value: string }>;
  warehouses: WarehouseRecord[];
}

export function InterwarehouseTransferFilters({
  activeBucket,
  activeFilterCount,
  bucketItems,
  filters,
  hasActiveFilters,
  onChange,
  onBucketChange,
  onReset,
  transferTypes,
  warehouses,
}: InterwarehouseTransferFiltersProps) {
  const { t } = useI18n();
  const warehouseItems = [
    { label: t("All Warehouses"), value: "" },
    ...warehouses.map((warehouse) => ({
      label: warehouse.warehouse_name,
      value: String(warehouse.id),
    })),
  ];

  return (
    <FilterCard
      contentSx={{ pb: "18px !important" }}
      header={
        <Stack spacing={1}>
          <PageTabs
            ariaLabel={t("Inter-warehouse transfer status buckets")}
            items={bucketItems.map((item) => ({
              ...item,
              label: item.value === "all" ? t("ui.all") : t(item.label),
            }))}
            onChange={onBucketChange}
            value={activeBucket}
          />
          <Typography color="text.secondary" variant="caption">
            {t("filters.activeCount", { count: activeFilterCount })}
          </Typography>
        </Stack>
      }
    >
      <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField
            aria-label={t("From Warehouse")}
            fullWidth
            hiddenLabel
            onChange={(event) => onChange("fromWarehouseId", event.target.value)}
            select
            size="small"
            value={filters.fromWarehouseId}
          >
            {warehouseItems.map((warehouse) => (
              <MenuItem key={`from-${warehouse.value || "all"}`} value={warehouse.value}>
                {warehouse.label}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField
            aria-label={t("To Warehouse")}
            fullWidth
            hiddenLabel
            onChange={(event) => onChange("toWarehouseId", event.target.value)}
            select
            size="small"
            value={filters.toWarehouseId}
          >
            {warehouseItems.map((warehouse) => (
              <MenuItem key={`to-${warehouse.value || "all"}`} value={warehouse.value}>
                {warehouse.label}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField
            aria-label={t("Transfer Type")}
            fullWidth
            hiddenLabel
            onChange={(event) => onChange("transferType", event.target.value)}
            select
            size="small"
            value={filters.transferType}
          >
            {transferTypes.map((option) => (
              <MenuItem key={option.value || "all"} value={option.value}>
                {t(option.label)}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <Box
            sx={(theme) => ({
              border: `1px solid ${alpha(theme.palette.divider, 0.86)}`,
              borderRadius: 2.5,
              overflow: "hidden",
            })}
          >
            <Stack direction={{ xs: "column", md: "row" }} spacing={0}>
              <TextField
                aria-label={t("Transfer search field")}
                onChange={(event) =>
                  onChange(
                    "searchField",
                    event.target.value as InterwarehouseTransferFilters["searchField"],
                  )
                }
                select
                size="small"
                sx={{
                  minWidth: { md: 132 },
                  "& .MuiOutlinedInput-notchedOutline": { border: 0 },
                }}
                value={filters.searchField}
              >
                <MenuItem value="transfer_number">{t("Transfer No.")}</MenuItem>
                <MenuItem value="reference_code">{t("Reference")}</MenuItem>
                <MenuItem value="notes">{t("Note")}</MenuItem>
                <MenuItem value="details">{t("Details")}</MenuItem>
              </TextField>
              <TextField
                aria-label={t("Transfer search")}
                fullWidth
                onChange={(event) => onChange("searchText", event.target.value)}
                placeholder={t("Search content")}
                size="small"
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchRoundedIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  },
                }}
                sx={{
                  "& .MuiOutlinedInput-notchedOutline": { border: 0 },
                }}
                value={filters.searchText}
              />
            </Stack>
          </Box>
        </Grid>
        <Grid size={{ xs: 12, md: 2 }}>
          <TextField
            aria-label={t("Transfer search mode")}
            fullWidth
            hiddenLabel
            onChange={(event) =>
              onChange(
                "searchMode",
                event.target.value as InterwarehouseTransferFilters["searchMode"],
              )
            }
            select
            size="small"
            value={filters.searchMode}
          >
            <MenuItem value="contains">{t("Fuzzy Search")}</MenuItem>
            <MenuItem value="exact">{t("Precise Search")}</MenuItem>
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <RangePicker
            active={Boolean(filters.dateFrom || filters.dateTo)}
            endAriaLabel={t("Transfer end date")}
            endValue={filters.dateTo}
            fullWidth
            inputType="date"
            leadingContent={
              <TextField
                aria-label={t("Transfer date field")}
                onChange={(event) =>
                  onChange(
                    "dateField",
                    event.target.value as InterwarehouseTransferFilters["dateField"],
                  )
                }
                select
                size="small"
                sx={{
                  minWidth: { md: 124 },
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 2,
                    height: 38,
                  },
                }}
                value={filters.dateField}
              >
                <MenuItem value="create_time">{t("Create Time")}</MenuItem>
                <MenuItem value="requested_date">{t("Requested Date")}</MenuItem>
              </TextField>
            }
            onEndChange={(value) => onChange("dateTo", value)}
            onStartChange={(value) => onChange("dateFrom", value)}
            rootSx={{ height: "100%", minHeight: 40 }}
            startAriaLabel={t("Transfer start date")}
            startValue={filters.dateFrom}
          />
        </Grid>
        <Grid size={{ xs: 12, md: "auto" }}>
          <Button
            disabled={!hasActiveFilters}
            onClick={onReset}
            sx={{ minWidth: 92 }}
            variant="outlined"
          >
            {t("Reset")}
          </Button>
        </Grid>
      </Grid>
    </FilterCard>
  );
}
