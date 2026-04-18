import { Box, Button, Chip, MenuItem, Stack, TextField } from "@mui/material";

import type { StockOutListFilters } from "@/features/outbound/model/stock-out-list";
import {
  stockOutDateFieldOptions,
  stockOutExceptionOptions,
  stockOutFulfillmentStageOptions,
  stockOutMatchModeOptions,
  stockOutOrderTypeOptions,
  stockOutSearchFieldOptions,
  stockOutStatusOptions,
  stockOutWaybillPrintedOptions,
} from "@/features/outbound/model/stock-out-list";
import { FieldSelectorFilter } from "@/shared/components/field-selector-filter";
import { FilterCard } from "@/shared/components/filter-card";
import { RangePicker } from "@/shared/components/range-picker";

interface StockOutFiltersCardProps {
  activeFilterCount: number;
  customerOptions: Array<{ label: string; value: string }>;
  filters: StockOutListFilters;
  onChange: (key: keyof StockOutListFilters & string, value: string) => void;
  onReset: () => void;
  resultCount?: number;
}

const fieldBoxSx = {
  flex: "1 1 180px",
  minWidth: {
    sm: 180,
    xs: "100%",
  },
} as const;

export function StockOutFiltersCard({
  activeFilterCount,
  customerOptions,
  filters,
  onChange,
  onReset,
  resultCount,
}: StockOutFiltersCardProps) {
  return (
    <FilterCard
      header={(
        <Stack
          alignItems={{ md: "center" }}
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          spacing={1.25}
        >
          <Stack direction="row" flexWrap="wrap" gap={1}>
            <Chip color="primary" label={`Active filters: ${activeFilterCount}`} size="small" variant="outlined" />
            {typeof resultCount === "number" ? <Chip label={`Visible rows: ${resultCount}`} size="small" /> : null}
          </Stack>
          <Button color="inherit" onClick={onReset} size="small">
            Reset
          </Button>
        </Stack>
      )}
    >
      <Stack direction="row" flexWrap="wrap" gap={1.5}>
        <Box sx={fieldBoxSx}>
          <TextField
            fullWidth
            label="Client"
            onChange={(event) => onChange("customerAccountId", event.target.value)}
            select
            size="small"
            value={filters.customerAccountId}
          >
            <MenuItem value="">All clients</MenuItem>
            {customerOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Box>
        <Box sx={fieldBoxSx}>
          <TextField
            fullWidth
            label="Order type"
            onChange={(event) => onChange("orderType", event.target.value)}
            select
            size="small"
            value={filters.orderType}
          >
            <MenuItem value="">All order types</MenuItem>
            {stockOutOrderTypeOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Box>
        <Box sx={fieldBoxSx}>
          <TextField
            fullWidth
            label="Package type"
            onChange={(event) => onChange("packageType", event.target.value)}
            placeholder="Carton, polybag"
            size="small"
            value={filters.packageType}
          />
        </Box>
        <Box sx={fieldBoxSx}>
          <TextField
            fullWidth
            label="Logistics provider"
            onChange={(event) => onChange("logisticsProvider", event.target.value)}
            placeholder="UPS, FedEx"
            size="small"
            value={filters.logisticsProvider}
          />
        </Box>
        <Box sx={fieldBoxSx}>
          <TextField
            fullWidth
            label="Shipping method"
            onChange={(event) => onChange("shippingMethod", event.target.value)}
            placeholder="Ground, Express"
            size="small"
            value={filters.shippingMethod}
          />
        </Box>
        <Box sx={fieldBoxSx}>
          <TextField
            fullWidth
            label="Waybill"
            onChange={(event) => onChange("waybillPrinted", event.target.value)}
            select
            size="small"
            value={filters.waybillPrinted}
          >
            <MenuItem value="">All waybill states</MenuItem>
            {stockOutWaybillPrintedOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Box>
        <Box sx={fieldBoxSx}>
          <TextField
            fullWidth
            label="Status"
            onChange={(event) => onChange("status", event.target.value)}
            select
            size="small"
            value={filters.status}
          >
            <MenuItem value="">All statuses</MenuItem>
            {stockOutStatusOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Box>
        <Box sx={fieldBoxSx}>
          <TextField
            fullWidth
            label="Stage"
            onChange={(event) => onChange("fulfillmentStage", event.target.value)}
            select
            size="small"
            value={filters.fulfillmentStage}
          >
            <MenuItem value="">All stages</MenuItem>
            {stockOutFulfillmentStageOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Box>
        <Box sx={fieldBoxSx}>
          <TextField
            fullWidth
            label="Exception"
            onChange={(event) => onChange("exceptionState", event.target.value)}
            select
            size="small"
            value={filters.exceptionState}
          >
            <MenuItem value="">All exception states</MenuItem>
            {stockOutExceptionOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Box>
      </Stack>

      <Stack direction="row" flexWrap="wrap" gap={1.5}>
        <FieldSelectorFilter sx={{ flex: "2 1 420px", minWidth: { xs: "100%", md: 420 } }}>
          <TextField
            onChange={(event) => onChange("searchField", event.target.value)}
            select
            size="small"
            sx={{ minWidth: 168 }}
            value={filters.searchField}
          >
            {stockOutSearchFieldOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            fullWidth
            onChange={(event) => onChange("searchText", event.target.value)}
            placeholder="Search stock-out queue"
            size="small"
            value={filters.searchText}
          />
          <TextField
            onChange={(event) => onChange("matchMode", event.target.value)}
            select
            size="small"
            sx={{ minWidth: 120 }}
            value={filters.matchMode}
          >
            {stockOutMatchModeOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </FieldSelectorFilter>

        <Box sx={{ flex: "1 1 360px", minWidth: { xs: "100%", md: 360 } }}>
          <RangePicker
            endAriaLabel="Stock-out date end"
            endPlaceholder="End date"
            endValue={filters.dateTo}
            fullWidth
            inputType="date"
            leadingContent={(
              <TextField
                fullWidth
                hiddenLabel
                onChange={(event) => onChange("dateField", event.target.value)}
                select
                size="small"
                value={filters.dateField}
              >
                {stockOutDateFieldOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            )}
            onEndChange={(value) => onChange("dateTo", value)}
            onStartChange={(value) => onChange("dateFrom", value)}
            startAriaLabel="Stock-out date start"
            startPlaceholder="Start date"
            startValue={filters.dateFrom}
          />
        </Box>

        <Box sx={{ flex: "1 1 320px", minWidth: { xs: "100%", md: 320 } }}>
          <RangePicker
            endAriaLabel="Package count maximum"
            endPlaceholder="Max packages"
            endValue={filters.packageCountMax}
            fieldSx={{ "& .MuiOutlinedInput-root": { minWidth: { md: 132 } } }}
            fullWidth
            inputType="number"
            leadingContent={(
              <TextField
                fullWidth
                hiddenLabel
                size="small"
                slotProps={{ input: { readOnly: true } }}
                value="Package count"
              />
            )}
            onEndChange={(value) => onChange("packageCountMax", value)}
            onStartChange={(value) => onChange("packageCountMin", value)}
            startAriaLabel="Package count minimum"
            startPlaceholder="Min packages"
            startValue={filters.packageCountMin}
          />
        </Box>
      </Stack>
    </FilterCard>
  );
}
