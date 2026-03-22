import { useRef, useState } from "react";

import { Alert, Button, Stack, Typography } from "@mui/material";

import { MutationCard } from "@/shared/components/mutation-card";

const templateHeaders = [
  "purchase_order_number",
  "asn_number",
  "receipt_number",
  "receipt_location_barcode",
  "goods_barcode",
  "received_qty",
  "stock_status",
  "unit_cost",
  "lot_number",
  "serial_number",
  "lpn_barcode",
  "attribute_scan",
  "reference_code",
  "notes",
];

interface StockInImportPanelProps {
  errorMessage?: string | null;
  isPending: boolean;
  onSubmit: (file: File) => Promise<unknown> | void;
  successMessage?: string | null;
}

function downloadTemplate() {
  const csvContent = `${templateHeaders.join(",")}\nPO-1001,,RCPT-1001,RCV-01,SKU-1001,1.0000,AVAILABLE,0,,,LPN-1001,,IMPORT-1001,`;
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "stock-in-import-template.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export function StockInImportPanel({
  errorMessage,
  isPending,
  onSubmit,
  successMessage,
}: StockInImportPanelProps) {
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleSubmit = async () => {
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setLocalError("Select a CSV file before importing.");
      return;
    }
    setLocalError(null);
    await onSubmit(file);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    setSelectedFileName(null);
  };

  return (
    <MutationCard
      description="Bulk receive stock-in rows from a CSV manifest. Each row is processed through the same scan-receive validation used by handheld intake."
      errorMessage={errorMessage ?? localError}
      successMessage={successMessage}
      title="Import to stock-in"
    >
      <Stack spacing={2}>
        <Alert severity="info">
          Use the CSV template for manifest uploads. Provide either <code>purchase_order_number</code> or{" "}
          <code>asn_number</code> per row.
        </Alert>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
          <Button onClick={downloadTemplate} type="button" variant="outlined">
            Download CSV template
          </Button>
          <Button component="label" variant="outlined">
            Choose CSV file
            <input
              accept=".csv,text/csv"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setSelectedFileName(file?.name ?? null);
                setLocalError(null);
              }}
              ref={inputRef}
              type="file"
            />
          </Button>
          <Button disabled={isPending} onClick={() => void handleSubmit()} type="button" variant="contained">
            {isPending ? "Importing..." : "Run import"}
          </Button>
        </Stack>
        <Typography color="text.secondary" variant="body2">
          {selectedFileName ? `Selected file: ${selectedFileName}` : "No file selected yet."}
        </Typography>
      </Stack>
    </MutationCard>
  );
}
