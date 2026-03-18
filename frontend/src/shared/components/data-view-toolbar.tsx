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

import type { DataViewFilters } from "@/shared/hooks/use-data-view";
import type { SavedDataView } from "@/shared/storage/data-view-storage";

interface FilterOption {
  label: string;
  value: string;
}

export interface DataViewFieldConfig<TFilters extends DataViewFilters> {
  key: keyof TFilters & string;
  label: string;
  type?: "text" | "select" | "date";
  placeholder?: string;
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
  contextLabel?: string;
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

  return (
    <>
      <Card variant="outlined">
        <CardContent sx={{ pb: "16px !important" }}>
          <Stack spacing={2}>
            <Stack alignItems={{ md: "center" }} direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5}>
              <Stack direction="row" flexWrap="wrap" spacing={1}>
                {contextLabel ? <Chip color="primary" label={contextLabel} variant="outlined" /> : null}
                <Chip label={`${activeFilterCount} active filter${activeFilterCount === 1 ? "" : "s"}`} size="small" />
                {typeof resultCount === "number" ? <Chip label={`${resultCount} result${resultCount === 1 ? "" : "s"}`} size="small" variant="outlined" /> : null}
              </Stack>
              <Stack direction="row" flexWrap="wrap" spacing={1}>
                {savedViews ? (
                  <>
                    <TextField
                      label="Saved view"
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
                      <MenuItem value="">Current filters</MenuItem>
                      {savedViews.items.map((view) => (
                        <MenuItem key={view.id} value={view.id}>
                          {view.name}
                        </MenuItem>
                      ))}
                    </TextField>
                    <Button onClick={() => setIsSaveDialogOpen(true)} size="small" variant="outlined">
                      Save view
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
                      Delete
                    </Button>
                  </>
                ) : null}
                <Button color="inherit" onClick={onReset} size="small">
                  Clear filters
                </Button>
                {actions}
              </Stack>
            </Stack>
            <Stack direction="row" flexWrap="wrap" gap={1.5}>
              {fields.map((field) => (
                <Box key={field.key} sx={{ minWidth: field.width ?? 180 }}>
                  <TextField
                    fullWidth
                    label={field.label}
                    onChange={(event) => onChange(field.key, event.target.value as TFilters[typeof field.key])}
                    placeholder={field.placeholder}
                    select={field.type === "select"}
                    size="small"
                    type={field.type === "date" ? "date" : undefined}
                    value={filters[field.key] ?? ""}
                    slotProps={field.type === "date" ? { inputLabel: { shrink: true } } : undefined}
                  >
                    {field.type === "select"
                      ? [<MenuItem key="all" value="">All</MenuItem>, ...(field.options ?? []).map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
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
          <DialogTitle>Save current view</DialogTitle>
          <DialogContent>
            <Stack spacing={1.5} sx={{ pt: 1 }}>
              <Typography color="text.secondary" variant="body2">
                Save the current filter set so operators can get back to the same queue state quickly.
              </Typography>
              <TextField
                autoFocus
                label="View name"
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
              Cancel
            </Button>
            <Button
              onClick={() => {
                savedViews.onSave(viewName);
                setIsSaveDialogOpen(false);
                setViewName("");
              }}
              variant="contained"
            >
              Save
            </Button>
          </DialogActions>
        </Dialog>
      ) : null}
    </>
  );
}
