import { Autocomplete, TextField, type TextFieldProps } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { Controller, useFormContext } from "react-hook-form";
import { useEffect, useRef, type UIEvent } from "react";

import { useI18n } from "@/app/ui-preferences";
import type { ReferenceOption } from "@/shared/types/options";

export interface FormAutocompleteProps<TValue extends string | number>
  extends Omit<TextFieldProps, "name" | "value" | "defaultValue" | "onChange"> {
  name: string;
  options: ReferenceOption<TValue>[];
  loading?: boolean;
  emptyText?: string;
  searchText?: string;
  onSearchTextChange?: (value: string) => void;
  onReachEnd?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
}

export function FormAutocomplete<TValue extends string | number>({
  name,
  options,
  helperText,
  loading,
  emptyText = "No options",
  searchText,
  onSearchTextChange,
  onReachEnd,
  hasMore = false,
  isLoadingMore = false,
  ...props
}: FormAutocompleteProps<TValue>) {
  const { control } = useFormContext();
  const { translateText } = useI18n();
  const theme = useTheme();
  const optionCacheRef = useRef(new Map<TValue, ReferenceOption<TValue>>());

  useEffect(() => {
    for (const option of options) {
      optionCacheRef.current.set(option.value, option);
    }
  }, [options]);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const selectedOption =
          options.find((option) => option.value === field.value) ?? optionCacheRef.current.get(field.value) ?? null;
        const handleListboxScroll = (event: UIEvent<HTMLUListElement>) => {
          if (!onReachEnd || !hasMore || isLoadingMore) {
            return;
          }
          const listboxNode = event.currentTarget;
          const remaining = listboxNode.scrollHeight - listboxNode.scrollTop - listboxNode.clientHeight;
          if (remaining <= 48) {
            onReachEnd();
          }
        };

        return (
          <Autocomplete<ReferenceOption<TValue>, false, false, false>
            autoHighlight
            filterOptions={onSearchTextChange ? (availableOptions) => availableOptions : undefined}
            getOptionLabel={(option) => option.label}
            inputValue={searchText}
            isOptionEqualToValue={(option, value) => option.value === value.value}
            loading={loading || isLoadingMore}
            loadingText={translateText(isLoadingMore ? "Loading more..." : "Loading...")}
            noOptionsText={translateText(emptyText)}
            onChange={(_event, option) => field.onChange(option?.value ?? null)}
            onInputChange={(_event, value, reason) => {
              if (!onSearchTextChange) {
                return;
              }
              if (reason === "input" || reason === "clear") {
                onSearchTextChange(value);
              }
            }}
            options={options}
            renderInput={(params) => (
              <TextField
                {...params}
                {...props}
                error={fieldState.invalid}
                helperText={fieldState.error?.message ?? (typeof helperText === "string" ? translateText(helperText) : helperText)}
                fullWidth={props.fullWidth ?? true}
                label={typeof props.label === "string" ? translateText(props.label) : props.label}
              />
            )}
            renderOption={(optionProps, option) => (
              <li {...optionProps} key={option.value}>
                <div>
                  <div>{option.label}</div>
                  {option.description ? (
                    <div style={{ color: theme.palette.text.secondary, fontSize: "0.75rem" }}>
                      {option.description}
                    </div>
                  ) : null}
                </div>
              </li>
            )}
            slotProps={onReachEnd ? { listbox: { onScroll: handleListboxScroll } } : undefined}
            value={selectedOption}
          />
        );
      }}
    />
  );
}
