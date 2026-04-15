import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { Button, InputAdornment, MenuItem, Stack, TextField } from "@mui/material";

import { useI18n } from "@/app/ui-preferences";
import { FieldSelectorFilter } from "@/shared/components/field-selector-filter";
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
  bucketItems: ReadonlyArray<{ count?: number | string; label: string; value: InterwarehouseTransferBucket }>;
  compact?: boolean;
  filters: InterwarehouseTransferFilters;
  hasActiveFilters: boolean;
  onChange: <TKey extends keyof InterwarehouseTransferFilters>(
    key: TKey,
    value: InterwarehouseTransferFilters[TKey],
  ) => void;
  onBucketChange: (value: InterwarehouseTransferBucket) => void;
  onReset: () => void;
  showToWarehouseFilter?: boolean;
  showTransferTypeFilter?: boolean;
  statusBucketsAriaLabel?: string;
  transferTypes: ReadonlyArray<{ label: string; value: string }>;
  warehouses: WarehouseRecord[];
}

export function InterwarehouseTransferFilters({
  activeBucket,
  bucketItems,
  compact = false,
  filters,
  hasActiveFilters,
  onChange,
  onBucketChange,
  onReset,
  showToWarehouseFilter = true,
  showTransferTypeFilter = true,
  statusBucketsAriaLabel,
  transferTypes,
  warehouses,
}: InterwarehouseTransferFiltersProps) {
  const { t } = useI18n();
  const rowSpacing = compact ? 1.25 : 1.5;
  const primaryFieldFlex = compact ? "1 1 220px" : "1 1 240px";
  const searchFieldFlex = compact ? "1.8 1 360px" : "2.4 1 420px";
  const dateRangeFlex = compact ? "1.8 1 420px" : "2.2 1 500px";
  const warehouseItems = [
    { label: t("All Warehouses"), value: "" },
    ...warehouses.map((warehouse) => ({
      label: warehouse.warehouse_name,
      value: String(warehouse.id),
    })),
  ];

  return (
    <FilterCard
      contentSx={{
        pb: compact ? "14px !important" : "18px !important",
        pt: compact ? 1.5 : 2.25,
      }}
      header={
        <Stack spacing={0.5}>
          <PageTabs
            ariaLabel={statusBucketsAriaLabel ?? t("Inter-warehouse transfer status buckets")}
            items={bucketItems.map((item) => ({
              ...item,
              label: item.value === "all" ? t("ui.all") : t(item.label),
            }))}
            onChange={onBucketChange}
            value={activeBucket}
          />
        </Stack>
      }
    >
      <Stack spacing={rowSpacing} sx={{ minWidth: 0 }}>
        <Stack direction="row" spacing={rowSpacing} sx={{ flexWrap: "wrap", minWidth: 0 }} useFlexGap>
          <TextField
            aria-label={t("From Warehouse")}
            fullWidth
            hiddenLabel
            onChange={(event) => onChange("fromWarehouseId", event.target.value)}
            select
            size="small"
            sx={{
              flex: primaryFieldFlex,
              minWidth: { sm: compact ? 220 : 240, xs: "100%" },
            }}
            value={filters.fromWarehouseId}
          >
            {warehouseItems.map((warehouse) => (
              <MenuItem key={`from-${warehouse.value || "all"}`} value={warehouse.value}>
                {warehouse.label}
              </MenuItem>
            ))}
          </TextField>
          {showToWarehouseFilter ? (
            <TextField
              aria-label={t("To Warehouse")}
              fullWidth
              hiddenLabel
              onChange={(event) => onChange("toWarehouseId", event.target.value)}
              select
              size="small"
              sx={{
                flex: primaryFieldFlex,
                minWidth: { sm: compact ? 220 : 240, xs: "100%" },
              }}
              value={filters.toWarehouseId}
            >
              {warehouseItems.map((warehouse) => (
                <MenuItem key={`to-${warehouse.value || "all"}`} value={warehouse.value}>
                  {warehouse.label}
                </MenuItem>
              ))}
            </TextField>
          ) : null}
          {showTransferTypeFilter ? (
            <TextField
              aria-label={t("Transfer Type")}
              fullWidth
              hiddenLabel
              onChange={(event) => onChange("transferType", event.target.value)}
              select
              size="small"
              sx={{
                flex: primaryFieldFlex,
                minWidth: { sm: compact ? 220 : 240, xs: "100%" },
              }}
              value={filters.transferType}
            >
              {transferTypes.map((option) => (
                <MenuItem key={option.value || "all"} value={option.value}>
                  {t(option.label)}
                </MenuItem>
              ))}
            </TextField>
          ) : null}
        </Stack>
        <Stack
          alignItems={{ lg: "center", xs: "stretch" }}
          direction={{ lg: "row", xs: "column" }}
          spacing={rowSpacing}
          sx={{ minWidth: 0 }}
          useFlexGap
        >
          <FieldSelectorFilter sx={{ flex: searchFieldFlex, minWidth: 0, width: "100%" }}>
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
                flex: { lg: "0 0 180px", xs: "1 1 auto" },
                minWidth: { lg: 180, xs: "100%" },
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
              sx={{ flex: "1 1 220px", minWidth: 0 }}
              value={filters.searchText}
            />
          </FieldSelectorFilter>
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
            sx={{
              flex: { lg: "1 1 196px", xs: "1 1 auto" },
              minWidth: { lg: 196, xs: "100%" },
            }}
            value={filters.searchMode}
          >
            <MenuItem value="contains">{t("Fuzzy Search")}</MenuItem>
            <MenuItem value="exact">{t("Precise Search")}</MenuItem>
          </TextField>
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
                  minWidth: { lg: 156, xs: "100%" },
                  width: { lg: 156, xs: "100%" },
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
            fieldSx={{
              flex: { lg: "1 1 152px", xs: "1 1 auto" },
              minWidth: { lg: 152, xs: "100%" },
              width: { lg: 152, xs: "100%" },
            }}
            rootSx={{
              flex: dateRangeFlex,
              height: "auto",
              maxWidth: "100%",
              minHeight: 42,
              minWidth: 0,
              px: 0.625,
              py: 0.375,
              width: "100%",
            }}
            startAriaLabel={t("Transfer start date")}
            startValue={filters.dateFrom}
          />
          <Button
            disabled={!hasActiveFilters}
            onClick={onReset}
            sx={{
              alignSelf: { lg: "center", xs: "stretch" },
              flex: { lg: "0 0 auto", xs: "1 1 auto" },
              minWidth: 92,
            }}
            variant="outlined"
          >
            {t("Reset")}
          </Button>
        </Stack>
      </Stack>
    </FilterCard>
  );
}
