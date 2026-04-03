import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, List, ListItem, Stack, Typography } from "@mui/material";

import { useI18n } from "@/app/ui-preferences";

interface InventoryInformationImportDialogProps {
  open: boolean;
  selectedFileName: string | null;
  errorMessages: string[];
  isSubmitting: boolean;
  onClose: () => void;
  onDownloadTemplate: () => void;
  onFileChange: (file: File | null) => void;
  onSubmit: () => void;
}

const inventoryImportInstructions = [
  "Click the Add File button and select the local xlsx file to upload.",
  "The header in the template cannot be deleted or modified.",
  "The number of data imported at a time cannot exceed 5000.",
  "If the product already exists in the Inventory List, initialization fails.",
  "If the same product is in two picking area shelves, initialization fails.",
  "If Merchant SKU + Shelf are duplicated, the first one shall prevail.",
  "Each Merchant SKU can only appear once in the import file.",
  "If Listing Time is not filled in, it defaults to the import date.",
  "Listing Time only supports YYYY-MM-DD or YYYY/MM/DD.",
  'If actual size and weight are not maintained in "Product Management", this table must provide those values.',
] as const;

export function InventoryInformationImportDialog({
  open,
  selectedFileName,
  errorMessages,
  isSubmitting,
  onClose,
  onDownloadTemplate,
  onFileChange,
  onSubmit,
}: InventoryInformationImportDialogProps) {
  const { translateText } = useI18n();

  return (
    <Dialog fullWidth maxWidth="md" onClose={onClose} open={open}>
      <DialogTitle>{translateText("Import inventory information")}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Alert severity="info">
            {translateText(
              "Upload the JiFengWMS-style inventory initialization template. The backend parses, validates, and saves the normalized rows for this inventory workspace.",
            )}
          </Alert>
          {errorMessages.length > 0 ? (
            <Alert severity="error">
              <Box component="ul" sx={{ m: 0, pl: 2 }}>
                {errorMessages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </Box>
            </Alert>
          ) : null}
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
            <Button onClick={onDownloadTemplate} type="button" variant="outlined">
              {translateText("Download template")}
            </Button>
            <Button component="label" variant="outlined">
              {translateText("Add File")}
              <input
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                hidden
                onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
                type="file"
              />
            </Button>
            <Button disabled={!selectedFileName || isSubmitting} onClick={onSubmit} type="button" variant="contained">
              {isSubmitting ? translateText("Importing...") : translateText("Import XLSX")}
            </Button>
          </Stack>
          <Box
            sx={{
              border: (theme) => `1px dashed ${theme.palette.divider}`,
              borderRadius: 3,
              px: 2,
              py: 1.5,
            }}
          >
            <Typography fontWeight={600} variant="body2">
              {selectedFileName ? selectedFileName : translateText("No file selected")}
            </Typography>
            <Typography color="text.secondary" variant="caption">
              {translateText("Required fields: Merchant SKU, Shelf, Available Stock, and Unit of measurement.")}
            </Typography>
          </Box>
          <Divider />
          <Stack spacing={1}>
            <Typography variant="subtitle2">{translateText("Import constraints")}</Typography>
            <List dense disablePadding>
              {inventoryImportInstructions.map((instruction) => (
                <ListItem key={instruction} disableGutters sx={{ alignItems: "flex-start", py: 0.25 }}>
                  <Typography color="text.secondary" variant="body2">
                    {translateText(instruction)}
                  </Typography>
                </ListItem>
              ))}
            </List>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          {translateText("Close")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
