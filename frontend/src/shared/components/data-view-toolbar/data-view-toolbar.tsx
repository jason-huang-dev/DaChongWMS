import { useState, type ReactNode } from "react";

import {
  Card,
  CardContent,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import type { MessageDescriptor, TranslatableText } from "@/app/i18n";
import { isMessageDescriptor } from "@/app/i18n";
import { useI18n } from "@/app/ui-preferences";
import type { DataViewFilters } from "@/shared/hooks/use-data-view";
import type { SavedDataView } from "@/shared/storage/data-view-storage";

interface FilterOption {
  label: TranslatableText;
  value: string;
}

export interface DataViewFieldConfig<TFilters extends DataViewFilters> {
  key: keyof TFilters & string;
  label: TranslatableText;
  type?: "text" | "select" | "date";
  placeholder?: TranslatableText;
  options?: FilterOption[];
  width?: number;
}

interface DataViewToolbarProps<TFilters extends DataViewFilters> {
  fields: DataViewFieldConfig<TFilters>[];
  filters: TFilters;
  onChange: (key: keyof TFilters & string, value: string) => void;
  onReset: () => void;
  activeFilterCount: number;
  resultCount?: number;
  contextLabel?: ReactNode | MessageDescriptor;
  actions?: ReactNode;
  savedViews?: {
    items: SavedDataView<TFilters>[];
    selectedId: string | null;
    onApply: (viewId: string) => void;
    onSave: (name: string) => void;
    onDelete: (viewId: string) => void;
  };
}

export function DataViewToolbar<TFilters extends DataViewFilters>({
  fields,
  filters,
  onChange,
  onReset,
  activeFilterCount,
  resultCount,
  contextLabel,
  actions,
  savedViews,
}: DataViewToolbarProps<TFilters>) {
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const { t, translate } = useI18n();

  return (
    <>
      <Card variant="outlined">
        <CardContent sx={{ pb: "16px !important" }}>
          <Stack spacing={2}>
            <Stack alignItems={{ md: "center" }} direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5}>
              <Stack direction="row" flexWrap="wrap" spacing={1}>
                {contextLabel ? (
                  <Chip
                    color="primary"
                    label={isMessageDescriptor(contextLabel) ? translate(contextLabel) : contextLabel}
                    variant="outlined"
                  />
                ) : null}
                <Chip label={t("filters.activeCount", { count: activeFilterCount })} size="small" />
                {typeof resultCount === "number" ? (
                  <Chip label={t("filters.resultCount", { count: resultCount })} size="small" variant="outlined" />
                ) : null}
              </Stack>
              <Stack direction="row" flexWrap="wrap" spacing={1}>
                {savedViews ? (
                  <>
                    <TextField
                      label={t("filters.savedView")}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        if (nextValue) {
                          savedViews.onApply(nextValue);
                        }
                      }}
                      select
                      size="small"
                      sx={{ minWidth: 180 }}
                      value={savedViews.selectedId ?? ""}
                    >
                      <MenuItem value="">{t("filters.currentFilters")}</MenuItem>
                      {savedViews.items.map((view) => (
                        <MenuItem key={view.id} value={view.id}>
                          {view.name}
                        </MenuItem>
                      ))}
                    </TextField>
                    <Button onClick={() => setIsSaveDialogOpen(true)} size="small" variant="outlined">
                      {t("filters.saveView")}
                    </Button>
                    <Button
                      color="inherit"
                      disabled={!savedViews.selectedId}
                      onClick={() => {
                        if (savedViews.selectedId) {
                          savedViews.onDelete(savedViews.selectedId);
                        }
                      }}
                      size="small"
                    >
                      {t("ui.delete")}
                    </Button>
                  </>
                ) : null}
                <Button color="inherit" onClick={onReset} size="small">
                  {t("filters.clearFilters")}
                </Button>
                {actions}
              </Stack>
            </Stack>
            <Stack direction="row" flexWrap="wrap" gap={1.5}>
              {fields.map((field) => (
                <Box key={field.key} sx={{ minWidth: field.width ?? 180 }}>
                  <TextField
                    fullWidth
                    label={translate(field.label)}
                    onChange={(event) => onChange(field.key, event.target.value as TFilters[typeof field.key])}
                    placeholder={field.placeholder ? translate(field.placeholder) : undefined}
                    select={field.type === "select"}
                    size="small"
                    type={field.type === "date" ? "date" : undefined}
                    value={filters[field.key] ?? ""}
                    slotProps={field.type === "date" ? { inputLabel: { shrink: true } } : undefined}
                  >
                    {field.type === "select"
                      ? [<MenuItem key="all" value="">{t("ui.all")}</MenuItem>, ...(field.options ?? []).map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                            {translate(option.label)}
                        </MenuItem>
                      ))]
                      : null}
                  </TextField>
                </Box>
              ))}
            </Stack>
          </Stack>
        </CardContent>
      </Card>
      {savedViews ? (
        <Dialog fullWidth maxWidth="xs" onClose={() => setIsSaveDialogOpen(false)} open={isSaveDialogOpen}>
          <DialogTitle>{t("filters.saveCurrentView")}</DialogTitle>
          <DialogContent>
            <Stack spacing={1.5} sx={{ pt: 1 }}>
              <Typography color="text.secondary" variant="body2">
                {t("filters.saveCurrentViewDescription")}
              </Typography>
              <TextField
                autoFocus
                label={t("filters.viewName")}
                onChange={(event) => setViewName(event.target.value)}
                value={viewName}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button
              color="inherit"
              onClick={() => {
                setIsSaveDialogOpen(false);
                setViewName("");
              }}
            >
              {t("ui.cancel")}
            </Button>
            <Button
              onClick={() => {
                savedViews.onSave(viewName);
                setIsSaveDialogOpen(false);
                setViewName("");
              }}
              variant="contained"
            >
              {t("ui.save")}
            </Button>
          </DialogActions>
        </Dialog>
      ) : null}
    </>
  );
}
