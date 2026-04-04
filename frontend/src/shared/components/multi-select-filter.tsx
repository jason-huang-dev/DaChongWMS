import { Autocomplete, Box, Checkbox, Chip, TextField } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { SxProps, Theme } from "@mui/material/styles";

export interface MultiSelectFilterOption {
  label: string;
  value: string;
}

interface MultiSelectFilterProps {
  label: string;
  onChange: (nextValues: string[]) => void;
  options: MultiSelectFilterOption[];
  placeholder: string;
  selectedValues: string[];
  sx?: SxProps<Theme>;
}

export function MultiSelectFilter({
  label,
  onChange,
  options,
  placeholder,
  selectedValues,
  sx,
}: MultiSelectFilterProps) {
  const selectedOptions = options.filter((option) => selectedValues.includes(option.value));
  const hasSelection = selectedOptions.length > 0;

  return (
    <Autocomplete
      disableClearable={!hasSelection}
      disableCloseOnSelect
      forcePopupIcon={!hasSelection}
      limitTags={1}
      multiple
      onChange={(_event, nextOptions) => onChange(nextOptions.map((option) => option.value))}
      options={options}
      getOptionLabel={(option) => option.label}
      isOptionEqualToValue={(option, selectedOption) => option.value === selectedOption.value}
      renderInput={(params) => (
        <TextField
          {...params}
          hiddenLabel
          inputProps={{
            ...params.inputProps,
            "aria-label": label,
          }}
          placeholder={hasSelection ? undefined : placeholder}
          size="small"
        />
      )}
      renderOption={(props, option, { selected }) => (
        <Box component="li" {...props} sx={{ fontSize: (theme) => theme.typography.body2.fontSize }}>
          <Checkbox checked={selected} size="small" sx={{ mr: 1 }} />
          {option.label}
        </Box>
      )}
      renderTags={(tagValue, getTagProps) => {
        const primaryTag = tagValue[0];

        if (!primaryTag) {
          return null;
        }

        return (
          <Box
            sx={{
              alignItems: "center",
              display: "flex",
              gap: 0.5,
              maxWidth: "100%",
              minWidth: 0,
              overflow: "hidden",
            }}
          >
            <Chip
              {...getTagProps({ index: 0 })}
              label={primaryTag.label}
              size="small"
              sx={{
                maxWidth: tagValue.length > 1 ? "calc(100% - 24px)" : "100%",
                minWidth: 0,
                "& .MuiChip-label": {
                  overflow: "hidden",
                  px: 0.75,
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                },
              }}
            />
            {tagValue.length > 1 ? (
              <Box
                component="span"
                sx={{
                  color: "text.secondary",
                  flex: "0 0 auto",
                  fontSize: (theme) => theme.typography.caption.fontSize,
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                }}
              >
                +{tagValue.length - 1}
              </Box>
            ) : null}
          </Box>
        );
      }}
      sx={[
        {
          flex: "1 1 0",
          minWidth: 168,
          overflow: "hidden",
          "& .MuiAutocomplete-tag": {
            height: 20,
            maxWidth: "100%",
          },
          "& .MuiChip-label": {
            fontSize: (theme) => theme.typography.caption.fontSize,
            px: 0.75,
          },
          "& .MuiAutocomplete-input": {
            minWidth: "0 !important",
          },
          "& .MuiAutocomplete-inputRoot": {
            flexWrap: "nowrap",
            minWidth: 0,
            overflow: "hidden",
          },
          "& .MuiInputBase-input": {
            fontSize: (theme) => theme.typography.body2.fontSize,
            minWidth: 0,
            py: 0.875,
          },
          "& .MuiAutocomplete-endAdornment": {
            alignItems: "center",
            display: "flex",
            gap: 0.25,
            right: 8,
          },
          "& .MuiAutocomplete-popupIndicator, & .MuiAutocomplete-clearIndicator": {
            color: "text.secondary",
            p: 0.25,
          },
          "& .MuiAutocomplete-clearIndicator": hasSelection
            ? {
                opacity: 1,
                visibility: "visible",
              }
            : {
                display: "none",
              },
          "& .MuiOutlinedInput-root": {
            backgroundColor: (theme) => alpha(theme.palette.background.default, 0.34),
            borderRadius: 2,
            minHeight: 34,
            overflow: "hidden",
          },
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
      value={selectedOptions}
    />
  );
}
