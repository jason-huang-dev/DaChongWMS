import { Box, MenuItem, Stack, TextField } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import { useI18n } from "@/app/ui-preferences";
import type { ClientWorkbenchFilters } from "@/features/clients/controller/useClientsController";
import {
  clientCompanySearchFieldOptions,
  clientCustomerSearchFieldOptions,
  clientSearchPlaceholders,
  clientSetupSearchFieldOptions,
  clientTimeFieldOptions,
  clientMetricFieldOptions,
  type ClientCompanySearchField,
  type ClientCustomerSearchField,
  type ClientMetricField,
  type ClientSetupSearchField,
  type ClientTimeField,
} from "@/features/clients/model/client-accounts";
import { RangePicker } from "@/shared/components/range-picker";

interface ClientAccountFiltersProps {
  filters: ClientWorkbenchFilters;
  onChange: (key: keyof ClientWorkbenchFilters & string, value: string) => void;
}

export function ClientAccountFilters({
  filters,
  onChange,
}: ClientAccountFiltersProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t, translate, msg } = useI18n();

  const surfaceColor = alpha(theme.palette.background.paper, isDark ? 0.52 : 0.88);
  const surfaceBorder = `1px solid ${alpha(theme.palette.divider, isDark ? 0.52 : 0.8)}`;
  const groupShellSx = {
    alignItems: "center",
    backgroundColor: surfaceColor,
    border: surfaceBorder,
    borderRadius: 2.5,
    boxShadow: `inset 0 1px 0 ${alpha(theme.palette.common.white, isDark ? 0.05 : 0.72)}`,
    minHeight: 42,
    px: 0.625,
    py: 0.375,
  } as const;
  const compoundFieldSx = {
    "& .MuiInputBase-input": {
      fontSize: theme.typography.pxToRem(12),
      py: 0.625,
    },
    "& .MuiOutlinedInput-root": {
      backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.48 : 0.96),
      borderRadius: 999,
      height: 34,
      minHeight: 34,
    },
  } as const;
  const compactSelectorWidth = 156;
  const financeSelectorWidth = 168;
  const dateSelectorWidth = 156;

  return (
    <Stack spacing={0.875} sx={{ minWidth: 0 }}>
      <Box
        sx={{
          alignItems: "start",
          display: "grid",
          gap: 0.875,
          gridTemplateColumns: {
            lg: "minmax(0, 1fr) minmax(0, 1fr) auto",
            md: "repeat(2, minmax(0, 1fr))",
            xs: "minmax(0, 1fr)",
          },
          minWidth: 0,
        }}
      >
        <Stack
          alignItems="center"
          direction="row"
          spacing={1}
          useFlexGap
          sx={{
            ...groupShellSx,
            flexWrap: "wrap",
            minWidth: 0,
          }}
        >
        <TextField
          hiddenLabel
          onChange={(event) => onChange("customerField", event.target.value as ClientCustomerSearchField)}
          select
          size="small"
          value={filters.customerField}
          slotProps={{
            htmlInput: {
              "aria-label": t("Customer information field"),
            },
          }}
          sx={{
            flex: `0 0 ${compactSelectorWidth}px`,
            minWidth: compactSelectorWidth,
            width: compactSelectorWidth,
            ...compoundFieldSx,
          }}
        >
          {clientCustomerSearchFieldOptions.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {translate(option.label)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          hiddenLabel
          onChange={(event) => onChange("customerQuery", event.target.value)}
          placeholder={translate(clientSearchPlaceholders[filters.customerField])}
          size="small"
          value={filters.customerQuery}
          slotProps={{
            htmlInput: {
              "aria-label": t("Customer information"),
              autoCapitalize: "none",
              autoCorrect: "off",
              spellCheck: false,
            },
          }}
          sx={{
            flex: "1 1 220px",
            minWidth: 0,
            ...compoundFieldSx,
          }}
        />
        </Stack>

        <Stack
          alignItems="center"
          direction="row"
          spacing={1}
          useFlexGap
          sx={{
            ...groupShellSx,
            flexWrap: "wrap",
            minWidth: 0,
          }}
        >
        <TextField
          hiddenLabel
          onChange={(event) => onChange("companyField", event.target.value as ClientCompanySearchField)}
          select
          size="small"
          value={filters.companyField}
          slotProps={{
            htmlInput: {
              "aria-label": t("Company information field"),
            },
          }}
          sx={{
            flex: `0 0 ${compactSelectorWidth}px`,
            minWidth: compactSelectorWidth,
            width: compactSelectorWidth,
            ...compoundFieldSx,
          }}
        >
          {clientCompanySearchFieldOptions.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {translate(option.label)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          hiddenLabel
          onChange={(event) => onChange("companyQuery", event.target.value)}
          placeholder={translate(clientSearchPlaceholders[filters.companyField])}
          size="small"
          value={filters.companyQuery}
          slotProps={{
            htmlInput: {
              "aria-label": t("Company information"),
              autoCapitalize: "none",
              autoCorrect: "off",
              spellCheck: false,
            },
          }}
          sx={{
            flex: "1 1 220px",
            minWidth: 0,
            ...compoundFieldSx,
          }}
        />
        </Stack>

        <RangePicker
          endAriaLabel={t("Maximum finance value")}
          endInputProps={{ inputMode: "numeric" }}
          endPlaceholder={t("Max")}
          endValue={filters.financeMax}
          fieldSx={{
            minWidth: 0,
            width: { md: 108, xs: "100%" },
            ...compoundFieldSx,
          }}
          inputType="number"
          leadingContent={
            <TextField
              hiddenLabel
              onChange={(event) => onChange("financeField", event.target.value as ClientMetricField)}
              select
              size="small"
              value={filters.financeField}
              slotProps={{
                htmlInput: {
                  "aria-label": t("Finance field"),
                },
              }}
              sx={{
                minWidth: { md: financeSelectorWidth, xs: "100%" },
                width: { md: financeSelectorWidth, xs: "100%" },
                ...compoundFieldSx,
              }}
            >
              {clientMetricFieldOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {translate(option.label)}
                </MenuItem>
              ))}
            </TextField>
          }
          onEndChange={(value) => onChange("financeMax", value)}
          onStartChange={(value) => onChange("financeMin", value)}
          rootSx={{
            ...groupShellSx,
            gridColumn: {
              md: "1 / -1",
              lg: "auto",
            },
            height: "auto",
            justifySelf: {
              md: "start",
              xs: "stretch",
            },
            maxWidth: "100%",
            minHeight: 42,
            minWidth: 0,
            px: 0.625,
            py: 0.375,
            width: {
              lg: "fit-content",
              md: "100%",
              xs: "100%",
            },
          }}
          startAriaLabel={t("Minimum finance value")}
          startInputProps={{ inputMode: "numeric" }}
          startPlaceholder={t("Min")}
          startValue={filters.financeMin}
        />
      </Box>

      <Box
        sx={{
          alignItems: "start",
          display: "grid",
          gap: 0.875,
          gridTemplateColumns: {
            md: "minmax(0, 1fr) auto",
            xs: "minmax(0, 1fr)",
          },
          minWidth: 0,
        }}
      >
        <Stack
          alignItems="center"
          direction="row"
          spacing={1}
          useFlexGap
          sx={{
            ...groupShellSx,
            flexWrap: "wrap",
            minWidth: 0,
          }}
        >
        <TextField
          hiddenLabel
          onChange={(event) => onChange("setupField", event.target.value as ClientSetupSearchField)}
          select
          size="small"
          value={filters.setupField}
          slotProps={{
            htmlInput: {
              "aria-label": t("Account setup field"),
            },
          }}
          sx={{
            flex: `0 0 ${compactSelectorWidth}px`,
            minWidth: compactSelectorWidth,
            width: compactSelectorWidth,
            ...compoundFieldSx,
          }}
        >
          {clientSetupSearchFieldOptions.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {translate(option.label)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          hiddenLabel
          onChange={(event) => onChange("setupQuery", event.target.value)}
          placeholder={translate(clientSearchPlaceholders[filters.setupField])}
          size="small"
          value={filters.setupQuery}
          slotProps={{
            htmlInput: {
              "aria-label": t("Account setup"),
              autoCapitalize: "none",
              autoCorrect: "off",
              spellCheck: false,
            },
          }}
          sx={{
            flex: "1 1 220px",
            minWidth: 0,
            ...compoundFieldSx,
          }}
        />
        </Stack>

        <RangePicker
          endAriaLabel={t("Time to")}
          endPlaceholder={t("To")}
          endValue={filters.timeEnd}
          fieldSx={{
            minWidth: 0,
            width: { md: 140, xs: "100%" },
            ...compoundFieldSx,
          }}
          inputType="date"
          leadingContent={
            <TextField
              hiddenLabel
              onChange={(event) => onChange("timeField", event.target.value as ClientTimeField)}
              select
              size="small"
              value={filters.timeField}
              slotProps={{
                htmlInput: {
                  "aria-label": t("Time field"),
                },
              }}
              sx={{
                minWidth: { md: dateSelectorWidth, xs: "100%" },
                width: { md: dateSelectorWidth, xs: "100%" },
                ...compoundFieldSx,
              }}
            >
              {clientTimeFieldOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {translate(option.label)}
                </MenuItem>
              ))}
            </TextField>
          }
          onEndChange={(value) => onChange("timeEnd", value)}
          onStartChange={(value) => onChange("timeStart", value)}
          rootSx={{
            ...groupShellSx,
            height: "auto",
            justifySelf: {
              md: "start",
              xs: "stretch",
            },
            maxWidth: "100%",
            minHeight: 42,
            minWidth: 0,
            px: 0.625,
            py: 0.375,
            width: {
              md: "fit-content",
              xs: "100%",
            },
          }}
          startAriaLabel={t("Time from")}
          startPlaceholder={t("From")}
          startValue={filters.timeStart}
        />
      </Box>
    </Stack>
  );
}
