import { useEffect, useMemo, useState } from "react";

import RestartAltOutlinedIcon from "@mui/icons-material/RestartAltOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import Grid from "@mui/material/Grid";
import { Button, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import { ActionIconButton } from "@/shared/components/action-icon-button";

interface ClientAccountFiltersProps {
  filters: {
    searchField: string;
    searchMode: string;
    searchQuery: string;
    warehouse: string;
    chargingTemplate: string;
    settlementCurrency: string;
    contactPerson: string;
    distribution: string;
  };
  activeFilterCount: number;
  filterOptions: {
    warehouses: string[];
    chargingTemplates: string[];
    settlementCurrencies: string[];
    contactPeople: string[];
    distributionModes: string[];
  };
  onChange: (key: string, value: string) => void;
  onReset: () => void;
}

function toSelectOptions(values: string[], formatter?: (value: string) => string) {
  return values.map((value) => ({
    label: formatter ? formatter(value) : value,
    value,
  }));
}

function formatDistributionLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export function ClientAccountFilters({
  filters,
  activeFilterCount,
  filterOptions,
  onChange,
  onReset,
}: ClientAccountFiltersProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const [draftSearchQuery, setDraftSearchQuery] = useState(filters.searchQuery);

  const advancedFilterOptions = useMemo(
    () => ({
      warehouses: toSelectOptions(filterOptions.warehouses),
      chargingTemplates: toSelectOptions(filterOptions.chargingTemplates),
      settlementCurrencies: toSelectOptions(filterOptions.settlementCurrencies),
      contactPeople: toSelectOptions(filterOptions.contactPeople),
      distributionModes: toSelectOptions(filterOptions.distributionModes, formatDistributionLabel),
    }),
    [filterOptions],
  );

  useEffect(() => {
    setDraftSearchQuery(filters.searchQuery);
  }, [filters.searchQuery]);

  function applySearch() {
    onChange("searchQuery", draftSearchQuery);
  }

  const fieldSx = {
    "& .MuiOutlinedInput-root": {
      backgroundColor: isDark ? alpha(theme.palette.common.white, 0.03) : theme.palette.common.white,
      borderRadius: 1.5,
      minHeight: 44,
    },
  } as const;

  return (
    <Stack spacing={1.75}>
      <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}>
          <TextField
            aria-label="Warehouse filter"
            fullWidth
            onChange={(event) => onChange("warehouse", event.target.value)}
            select
            SelectProps={{
              displayEmpty: true,
              renderValue: (value) => {
                const selectedValue = typeof value === "string" ? value : "";
                return selectedValue || "All Warehouses";
              },
            }}
            size="small"
            sx={fieldSx}
            value={filters.warehouse}
          >
            <MenuItem value="">All Warehouses</MenuItem>
            {advancedFilterOptions.warehouses.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}>
          <TextField
            aria-label="Charging template filter"
            fullWidth
            onChange={(event) => onChange("chargingTemplate", event.target.value)}
            select
            SelectProps={{
              displayEmpty: true,
              renderValue: (value) => {
                const selectedValue = typeof value === "string" ? value : "";
                return selectedValue || "All Charging Template";
              },
            }}
            size="small"
            sx={fieldSx}
            value={filters.chargingTemplate}
          >
            <MenuItem value="">All Charging Template</MenuItem>
            {advancedFilterOptions.chargingTemplates.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}>
          <TextField
            aria-label="Settlement currency filter"
            fullWidth
            onChange={(event) => onChange("settlementCurrency", event.target.value)}
            select
            SelectProps={{
              displayEmpty: true,
              renderValue: (value) => {
                const selectedValue = typeof value === "string" ? value : "";
                return selectedValue || "Assign Currency";
              },
            }}
            size="small"
            sx={fieldSx}
            value={filters.settlementCurrency}
          >
            <MenuItem value="">Assign Currency</MenuItem>
            {advancedFilterOptions.settlementCurrencies.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}>
          <TextField
            aria-label="Contact person filter"
            fullWidth
            onChange={(event) => onChange("contactPerson", event.target.value)}
            select
            SelectProps={{
              displayEmpty: true,
              renderValue: (value) => {
                const selectedValue = typeof value === "string" ? value : "";
                return selectedValue || "All Contact Person";
              },
            }}
            size="small"
            sx={fieldSx}
            value={filters.contactPerson}
          >
            <MenuItem value="">All Contact Person</MenuItem>
            {advancedFilterOptions.contactPeople.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}>
          <TextField
            aria-label="Distribution filter"
            fullWidth
            onChange={(event) => onChange("distribution", event.target.value)}
            select
            SelectProps={{
              displayEmpty: true,
              renderValue: (value) => {
                const selectedValue = typeof value === "string" ? value : "";
                return (selectedValue && formatDistributionLabel(selectedValue)) || "Distribution";
              },
            }}
            size="small"
            sx={fieldSx}
            value={filters.distribution}
          >
            <MenuItem value="">Distribution</MenuItem>
            {advancedFilterOptions.distributionModes.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
      </Grid>

      <Stack
        alignItems={{ sm: "stretch", lg: "center" }}
        direction={{ xs: "column", lg: "row" }}
        justifyContent="space-between"
        spacing={1.5}
      >
        <Grid container spacing={0} sx={{ flex: 1, minWidth: 0 }}>
          <Grid size={{ xs: 12, sm: 4, md: 3 }}>
            <TextField
              aria-label="Search field"
              fullWidth
              onChange={(event) => onChange("searchField", event.target.value)}
              select
              size="small"
              sx={{
                ...fieldSx,
                "& .MuiOutlinedInput-root": {
                  ...fieldSx["& .MuiOutlinedInput-root"],
                  borderBottomRightRadius: { xs: 1.5, sm: 0 },
                  borderRight: { xs: undefined, sm: "none" },
                  borderTopRightRadius: { xs: 1.5, sm: 0 },
                },
              }}
              value={filters.searchField}
            >
              <MenuItem value="all">All Fields</MenuItem>
              <MenuItem value="code">Client Code</MenuItem>
              <MenuItem value="name">Client Name</MenuItem>
              <MenuItem value="contact">Contact</MenuItem>
              <MenuItem value="company">Company</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 8, md: 5 }}>
            <TextField
              aria-label="Client search query"
              fullWidth
              onChange={(event) => setDraftSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applySearch();
                }
              }}
              placeholder="Please enter"
              size="small"
              sx={{
                ...fieldSx,
                "& .MuiOutlinedInput-root": {
                  ...fieldSx["& .MuiOutlinedInput-root"],
                  borderRadius: { xs: 1.5, md: 0 },
                  borderRight: { xs: undefined, md: "none" },
                },
              }}
              value={draftSearchQuery}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 8, md: 3 }}>
            <TextField
              aria-label="Search mode"
              fullWidth
              onChange={(event) => onChange("searchMode", event.target.value)}
              select
              size="small"
              sx={{
                ...fieldSx,
                "& .MuiOutlinedInput-root": {
                  ...fieldSx["& .MuiOutlinedInput-root"],
                  borderRadius: { xs: 1.5, md: 0 },
                  borderRight: { xs: undefined, md: "none" },
                },
              }}
              value={filters.searchMode}
            >
              <MenuItem value="exact">Precise Search</MenuItem>
              <MenuItem value="contains">Fuzzy Search</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 4, md: 1 }}>
            <Stack direction="row" height="100%">
              <ActionIconButton
                aria-label="Search clients"
                onClick={applySearch}
                sx={{
                  borderBottomLeftRadius: { xs: 1.5, md: 0 },
                  borderBottomRightRadius: 1.5,
                  borderTopLeftRadius: { xs: 1.5, md: 0 },
                  borderTopRightRadius: 1.5,
                  height: 44,
                  width: { xs: "100%", md: 48 },
                }}
                title="Search clients"
              >
                <SearchOutlinedIcon fontSize="small" />
              </ActionIconButton>
            </Stack>
          </Grid>
        </Grid>
        {activeFilterCount > 0 ? (
          <Button color="inherit" onClick={onReset} size="small" startIcon={<RestartAltOutlinedIcon />} sx={{ flexShrink: 0 }}>
            Reset
          </Button>
        ) : null}
      </Stack>

      {activeFilterCount > 0 ? (
        <Typography color="text.secondary" variant="caption">
          {activeFilterCount} active filter{activeFilterCount === 1 ? "" : "s"}
        </Typography>
      ) : null}
    </Stack>
  );
}
