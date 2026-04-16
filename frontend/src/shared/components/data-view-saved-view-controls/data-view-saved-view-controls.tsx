import { useState } from "react";

import { Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from "@mui/material";

import { useI18n } from "@/app/ui-preferences";
import type { DataViewFilters } from "@/shared/hooks/use-data-view";
import type { SavedDataView } from "@/shared/storage/data-view-storage";

interface DataViewSavedViewControlsProps<TFilters extends DataViewFilters> {
  savedViews: SavedDataView<TFilters>[];
  selectedSavedViewId: string | null;
  onApplySavedView: (viewId: string) => void;
  onDeleteSavedView: (viewId: string) => void;
  onSaveSavedView: (name: string) => void;
}

export function DataViewSavedViewControls<TFilters extends DataViewFilters>({
  savedViews,
  selectedSavedViewId,
  onApplySavedView,
  onDeleteSavedView,
  onSaveSavedView,
}: DataViewSavedViewControlsProps<TFilters>) {
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const { t } = useI18n();

  return (
    <>
      <TextField
        label={t("filters.savedView")}
        onChange={(event) => {
          const nextValue = event.target.value;
          if (nextValue) {
            onApplySavedView(nextValue);
          }
        }}
        select
        size="small"
        sx={{ minWidth: 180 }}
        value={selectedSavedViewId ?? ""}
      >
        <MenuItem value="">{t("filters.currentFilters")}</MenuItem>
        {savedViews.map((view) => (
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
        disabled={!selectedSavedViewId}
        onClick={() => {
          if (selectedSavedViewId) {
            onDeleteSavedView(selectedSavedViewId);
          }
        }}
        size="small"
      >
        {t("ui.delete")}
      </Button>
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
              onSaveSavedView(viewName);
              setIsSaveDialogOpen(false);
              setViewName("");
            }}
            variant="contained"
          >
            {t("ui.save")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
