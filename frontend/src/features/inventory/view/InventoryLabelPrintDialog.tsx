import { useEffect, useMemo, useState } from "react";

import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import LocalPrintshopOutlinedIcon from "@mui/icons-material/LocalPrintshopOutlined";
import SellOutlinedIcon from "@mui/icons-material/SellOutlined";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import { useI18n } from "@/app/ui-preferences";
import type { InventoryInformationRow } from "@/features/inventory/model/types";

type InventoryLabelPaperType = "roll" | "sheet";
type JsPdfInstance = import("jspdf").jsPDF;

interface InventoryLabelTemplate {
  id: string;
  label: string;
  widthMm: number;
  heightMm: number;
  columns: number;
}

interface InventoryLabelPrintDialogProps {
  open: boolean;
  rows: InventoryInformationRow[];
  onClose: () => void;
}

const labelTemplates: InventoryLabelTemplate[] = [
  { id: "40x30", label: "Compact 40 x 30 mm", widthMm: 40, heightMm: 30, columns: 4 },
  { id: "50x30", label: "Shelf 50 x 30 mm", widthMm: 50, heightMm: 30, columns: 3 },
  { id: "60x40", label: "Warehouse 60 x 40 mm", widthMm: 60, heightMm: 40, columns: 3 },
] as const;

function buildProductThumbnailLabel(row: InventoryInformationRow) {
  const source = row.productName || row.merchantSku || row.merchantCode || "Product";
  const tokens = source
    .split(/[\s_-]+/u)
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    return "PR";
  }

  if (tokens.length === 1) {
    return tokens[0].slice(0, 2).toUpperCase();
  }

  return `${tokens[0][0] ?? ""}${tokens[1][0] ?? ""}`.toUpperCase();
}

function getBarcodeValue(row: InventoryInformationRow) {
  return row.productBarcode || row.merchantSku || row.merchantCode || row.id;
}

function getSuggestedQuantity(row: InventoryInformationRow) {
  const preferred = Math.round(row.availableStock || row.totalInventory || 1);
  return preferred > 0 ? preferred : 1;
}

function buildPseudoBarcodeSvgMarkup(value: string, width = 260, height = 72) {
  const normalized = value.trim() || "EMPTY";
  let cursor = 12;
  const rects: string[] = [];

  for (const character of normalized) {
    const binary = character.charCodeAt(0).toString(2).padStart(8, "0");
    for (const bit of binary) {
      const barWidth = bit === "1" ? 2 : 1;
      rects.push(`<rect x="${cursor}" y="4" width="${barWidth}" height="${height - 8}" fill="#111827" rx="0.5" ry="0.5" />`);
      cursor += bit === "1" ? 3 : 2;
      rects.push(`<rect x="${cursor}" y="4" width="1" height="${height - 8}" fill="#111827" rx="0.5" ry="0.5" />`);
      cursor += 2;
    }
    cursor += 2;
  }

  const viewBoxWidth = Math.max(width, cursor + 12);

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${viewBoxWidth} ${height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Barcode for ${normalized}">
      <rect width="${viewBoxWidth}" height="${height}" fill="#ffffff" rx="6" ry="6" />
      ${rects.join("")}
    </svg>
  `;
}

function buildPseudoBarcodeBars(value: string) {
  const normalized = value.trim() || "EMPTY";
  let cursor = 0;
  const bars: Array<{ x: number; width: number }> = [];

  for (const character of normalized) {
    const binary = character.charCodeAt(0).toString(2).padStart(8, "0");
    for (const bit of binary) {
      const barWidth = bit === "1" ? 2 : 1;
      bars.push({ x: cursor, width: barWidth });
      cursor += bit === "1" ? 3 : 2;
      bars.push({ x: cursor, width: 1 });
      cursor += 2;
    }
    cursor += 2;
  }

  return {
    bars,
    totalWidth: Math.max(cursor, 1),
    value: normalized,
  };
}

function expandRowsForPrint(rows: InventoryInformationRow[], quantities: Record<string, number>, excludedRowIds: string[]) {
  const excludedSet = new Set(excludedRowIds);
  const expandedRows: InventoryInformationRow[] = [];

  rows.forEach((row) => {
    if (excludedSet.has(row.id)) {
      return;
    }

    const quantity = Math.max(0, quantities[row.id] ?? 0);
    for (let index = 0; index < quantity; index += 1) {
      expandedRows.push(row);
    }
  });

  return expandedRows;
}

function truncatePdfText(doc: JsPdfInstance, value: string, maxWidth: number) {
  const normalized = value.trim();
  if (!normalized) {
    return "";
  }
  if (doc.getTextWidth(normalized) <= maxWidth) {
    return normalized;
  }

  let truncated = normalized;
  while (truncated.length > 1 && doc.getTextWidth(`${truncated}...`) > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return `${truncated}...`;
}

function drawPdfBarcode(doc: JsPdfInstance, value: string, x: number, y: number, width: number, height: number) {
  const pattern = buildPseudoBarcodeBars(value);
  const scale = width / pattern.totalWidth;

  doc.setFillColor(17, 24, 39);
  pattern.bars.forEach((bar) => {
    doc.rect(x + bar.x * scale, y, Math.max(0.16, bar.width * scale), height, "F");
  });
}

function drawPdfLabel(
  doc: JsPdfInstance,
  row: InventoryInformationRow,
  {
    x,
    y,
    width,
    height,
  }: {
    x: number;
    y: number;
    width: number;
    height: number;
  },
) {
  const barcodeValue = getBarcodeValue(row);
  const paddingX = Math.min(3, Math.max(1.8, width * 0.08));
  const paddingY = Math.min(3, Math.max(1.6, height * 0.08));
  const innerWidth = width - paddingX * 2;
  const footerY = y + height - paddingY;

  doc.setDrawColor(209, 213, 219);
  doc.setLineWidth(0.2);
  doc.roundedRect(x, y, width, height, 1.6, 1.6, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.2);
  doc.setTextColor(17, 24, 39);
  doc.text(truncatePdfText(doc, row.merchantSku || row.merchantCode || "SKU", innerWidth * 0.56), x + paddingX, y + paddingY + 2.2);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.4);
  doc.setTextColor(75, 85, 99);
  doc.text(
    truncatePdfText(doc, row.warehouseName || "Inventory", innerWidth * 0.42),
    x + width - paddingX,
    y + paddingY + 2.2,
    { align: "right" },
  );

  const nameStartY = y + paddingY + 6.2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.1);
  doc.setTextColor(17, 24, 39);
  const nameLines = doc.splitTextToSize(row.productName || row.merchantSku, innerWidth).slice(0, 2);
  doc.text(nameLines, x + paddingX, nameStartY);

  const barcodeTopY = nameStartY + nameLines.length * 3 + 1.4;
  const barcodeHeight = Math.max(7, footerY - barcodeTopY - 3.8);
  drawPdfBarcode(doc, barcodeValue, x + paddingX, barcodeTopY, innerWidth, barcodeHeight);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(17, 24, 39);
  doc.text(truncatePdfText(doc, barcodeValue, innerWidth * 0.68), x + paddingX, footerY);

  doc.setTextColor(75, 85, 99);
  doc.text(
    truncatePdfText(doc, row.shelf || "N/A", innerWidth * 0.26),
    x + width - paddingX,
    footerY,
    { align: "right" },
  );
}

async function buildLabelPdfBlob({
  rows,
  paperType,
  template,
}: {
  rows: InventoryInformationRow[];
  paperType: InventoryLabelPaperType;
  template: InventoryLabelTemplate;
}) {
  const { jsPDF } = await import("jspdf");

  if (paperType === "roll") {
    const doc = new jsPDF({
      compress: true,
      format: [template.widthMm, template.heightMm],
      orientation: template.widthMm > template.heightMm ? "landscape" : "portrait",
      unit: "mm",
    });

    rows.forEach((row, index) => {
      if (index > 0) {
        doc.addPage([template.widthMm, template.heightMm], template.widthMm > template.heightMm ? "landscape" : "portrait");
      }
      drawPdfLabel(doc, row, { x: 0, y: 0, width: template.widthMm, height: template.heightMm });
    });

    return doc.output("blob") as Blob;
  }

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 8;
  const gap = 4;
  const columns = template.columns;
  const rowsPerPage = Math.max(1, Math.floor((pageHeight - margin * 2 + gap) / (template.heightMm + gap)));
  const labelsPerPage = columns * rowsPerPage;
  const doc = new jsPDF({
    compress: true,
    format: "a4",
    orientation: "portrait",
    unit: "mm",
  });

  rows.forEach((row, index) => {
    if (index > 0 && index % labelsPerPage === 0) {
      doc.addPage("a4", "portrait");
    }

    const pageIndex = index % labelsPerPage;
    const columnIndex = pageIndex % columns;
    const rowIndex = Math.floor(pageIndex / columns);
    drawPdfLabel(doc, row, {
      x: margin + columnIndex * (template.widthMm + gap),
      y: margin + rowIndex * (template.heightMm + gap),
      width: template.widthMm,
      height: template.heightMm,
    });
  });

  return doc.output("blob") as Blob;
}

function parsePdfError(
  error: unknown,
  t: (key: string, params?: Record<string, string | number | null | undefined>) => string,
) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return t("Unable to generate the label PDF.");
}

function openPdfPreviewTab(pdfUrl: string, previewWindow: Window | null) {
  if (previewWindow && !previewWindow.closed) {
    previewWindow.location.replace(pdfUrl);
    previewWindow.focus();
    return true;
  }

  const fallbackWindow = window.open(pdfUrl, "_blank", "noopener,noreferrer");
  if (fallbackWindow && !fallbackWindow.closed) {
    fallbackWindow.focus();
    return true;
  }

  return false;
}

function PreviewLabel({
  row,
  template,
  paperType,
}: {
  row: InventoryInformationRow;
  template: InventoryLabelTemplate;
  paperType: InventoryLabelPaperType;
}) {
  const theme = useTheme();
  const barcodeMarkup = useMemo(() => buildPseudoBarcodeSvgMarkup(getBarcodeValue(row), 240, 72), [row]);

  return (
    <Box
      sx={{
        alignItems: "center",
        backgroundColor: alpha(theme.palette.background.paper, theme.palette.mode === "dark" ? 0.72 : 0.95),
        border: `1px dashed ${alpha(theme.palette.divider, 0.9)}`,
        borderRadius: 3,
        display: "flex",
        justifyContent: "center",
        minHeight: 220,
        overflow: "hidden",
        p: 3,
      }}
    >
      <Box
        sx={{
          backgroundColor: theme.palette.background.paper,
          border: `1px solid ${alpha(theme.palette.divider, 0.85)}`,
          borderRadius: 2.5,
          boxShadow: theme.shadows[2],
          display: "flex",
          flexDirection: "column",
          gap: 1,
          p: 1.5,
          transform: `scale(${paperType === "sheet" ? 1 : 1.08})`,
          transformOrigin: "center",
          width: `${template.widthMm * 3.1}px`,
        }}
      >
        <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={1}>
          <Typography sx={{ fontWeight: 800 }} variant="caption">
            {row.merchantSku || row.merchantCode}
          </Typography>
          <Typography color="text.secondary" variant="caption">
            {row.warehouseName || "Inventory"}
          </Typography>
        </Stack>
        <Typography sx={{ fontWeight: 700, lineHeight: 1.25 }} variant="body2">
          {row.productName || row.merchantSku}
        </Typography>
        <Box
          aria-hidden
          sx={{ "& svg": { display: "block", height: 72, width: "100%" } }}
          dangerouslySetInnerHTML={{ __html: barcodeMarkup }}
        />
        <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={1}>
          <Typography variant="caption">{getBarcodeValue(row)}</Typography>
          <Typography color="text.secondary" variant="caption">
            {row.shelf || "N/A"}
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
}

export function InventoryLabelPrintDialog({ open, rows, onClose }: InventoryLabelPrintDialogProps) {
  const theme = useTheme();
  const { t, translate, msg } = useI18n();
  const [paperType, setPaperType] = useState<InventoryLabelPaperType>("roll");
  const [templateId, setTemplateId] = useState(labelTemplates[0].id);
  const [bulkQuantity, setBulkQuantity] = useState("1");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [excludedRowIds, setExcludedRowIds] = useState<string[]>([]);
  const [printError, setPrintError] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setQuantities(
      Object.fromEntries(rows.map((row) => [row.id, getSuggestedQuantity(row)])),
    );
    setExcludedRowIds([]);
    setBulkQuantity("1");
    setPaperType("roll");
    setTemplateId(labelTemplates[0].id);
    setPrintError(null);
  }, [open, rows]);

  const template = useMemo(
    () => labelTemplates.find((option) => option.id === templateId) ?? labelTemplates[0],
    [templateId],
  );
  const visibleRows = useMemo(() => rows.filter((row) => !excludedRowIds.includes(row.id)), [excludedRowIds, rows]);
  const expandedRows = useMemo(() => expandRowsForPrint(rows, quantities, excludedRowIds), [excludedRowIds, quantities, rows]);
  const totalLabels = expandedRows.length;
  const previewRow = visibleRows[0] ?? rows[0] ?? null;

  const handleQuantityChange = (rowId: string, nextValue: string) => {
    const parsed = Number(nextValue);
    setQuantities((current) => ({
      ...current,
      [rowId]: Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0,
    }));
  };

  const handleApplyBulkQuantity = () => {
    const parsed = Number(bulkQuantity);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return;
    }

    const nextQuantity = Math.floor(parsed);
    setQuantities((current) =>
      Object.fromEntries(
        rows.map((row) => [row.id, excludedRowIds.includes(row.id) ? current[row.id] ?? 0 : nextQuantity]),
      ),
    );
  };

  const handleRemoveRow = (rowId: string) => {
    setExcludedRowIds((current) => (current.includes(rowId) ? current : [...current, rowId]));
  };

  const handlePrint = async () => {
    if (expandedRows.length === 0) {
      setPrintError(t("Add at least one label before printing."));
      return;
    }

    const previewWindow = window.open("", "_blank", "noopener,noreferrer");
    if (previewWindow) {
      previewWindow.document.write(
        "<!doctype html><title>Generating label PDF</title><body style='font-family:Helvetica,Arial,sans-serif;padding:24px;color:#111827'>Generating label PDF...</body>",
      );
      previewWindow.document.close();
    }

    setIsGeneratingPdf(true);
    try {
      const pdfBlob = await buildLabelPdfBlob({
        rows: expandedRows,
        paperType,
        template,
      });
      const pdfUrl = URL.createObjectURL(pdfBlob);
      const openedPreview = openPdfPreviewTab(pdfUrl, previewWindow);

      if (!openedPreview) {
        setPrintError(t("Allow pop-ups to preview the label PDF in a new tab."));
        window.setTimeout(() => {
          URL.revokeObjectURL(pdfUrl);
        }, 1_000);
        return;
      }

      window.setTimeout(() => {
        URL.revokeObjectURL(pdfUrl);
      }, 60_000);
      setPrintError(null);
    } catch (error) {
      if (previewWindow && !previewWindow.closed) {
        previewWindow.close();
      }
      setPrintError(parsePdfError(error, t));
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <Dialog fullWidth maxWidth="xl" onClose={onClose} open={open}>
      <DialogTitle>{t("Print labels")}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          {printError ? <Alert severity="error">{printError}</Alert> : null}
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: { xs: "1fr", lg: "320px minmax(0, 1fr)" },
            }}
          >
            <Stack spacing={2}>
              <Box
                sx={{
                  background: `linear-gradient(180deg, ${alpha(theme.palette.background.paper, theme.palette.mode === "dark" ? 0.72 : 0.98)} 0%, ${alpha(theme.palette.background.default, theme.palette.mode === "dark" ? 0.92 : 1)} 100%)`,
                  border: `1px solid ${alpha(theme.palette.divider, 0.88)}`,
                  borderRadius: 3,
                  p: 2,
                }}
              >
                <Stack spacing={1.75}>
                  <TextField
                    fullWidth
                    label={t("Template")}
                    onChange={(event) => setTemplateId(event.target.value)}
                    select
                    size="small"
                    value={templateId}
                  >
                    {labelTemplates.map((option) => (
                      <MenuItem key={option.id} value={option.id}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    fullWidth
                    label={t("Print surface")}
                    onChange={(event) => setPaperType(event.target.value as InventoryLabelPaperType)}
                    select
                    size="small"
                    value={paperType}
                  >
                    <MenuItem value="roll">{t("Roll labels")}</MenuItem>
                    <MenuItem value="sheet">{t("Sheet labels")}</MenuItem>
                  </TextField>
                  <Stack direction="row" spacing={1}>
                    <TextField
                      fullWidth
                      label={t("Bulk quantity")}
                      onChange={(event) => setBulkQuantity(event.target.value)}
                      size="small"
                      type="number"
                      value={bulkQuantity}
                    />
                    <Button onClick={handleApplyBulkQuantity} sx={{ flexShrink: 0 }} variant="outlined">
                      {t("Apply")}
                    </Button>
                  </Stack>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    <Chip
                      color="primary"
                      icon={<SellOutlinedIcon />}
                      label={t("ui.itemsCount", { count: visibleRows.length })}
                      size="small"
                    />
                    <Chip
                      label={t("ui.labelsCount", { count: totalLabels })}
                      size="small"
                      sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.12), color: theme.palette.primary.main }}
                    />
                  </Stack>
                </Stack>
              </Box>
              <Box
                sx={{
                  border: `1px solid ${alpha(theme.palette.divider, 0.88)}`,
                  borderRadius: 3,
                  p: 2,
                }}
              >
                <Typography sx={{ fontWeight: 800, mb: 1.5 }} variant="subtitle2">
                  {t("Preview")}
                </Typography>
                {previewRow ? (
                  <PreviewLabel paperType={paperType} row={previewRow} template={template} />
                ) : (
                  <Typography color="text.secondary" variant="body2">
                    {t("Select rows before opening the label printer.")}
                  </Typography>
                )}
              </Box>
            </Stack>

            <Box
              sx={{
                border: `1px solid ${alpha(theme.palette.divider, 0.88)}`,
                borderRadius: 3,
                overflow: "hidden",
              }}
            >
              <Stack
                direction="row"
                justifyContent="space-between"
                sx={{
                  backgroundColor: alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.08 : 0.04),
                  px: 2,
                  py: 1.25,
                }}
              >
                <Typography sx={{ fontWeight: 800 }} variant="subtitle2">
                  {t("Selected products")}
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  {t("Fine-tune the quantity for each SKU before printing.")}
                </Typography>
              </Stack>
              <Stack divider={<Divider flexItem />} sx={{ maxHeight: 540, overflowY: "auto" }}>
                {visibleRows.map((row) => (
                  <Box key={row.id} sx={{ px: 2, py: 1.75 }}>
                    <Box
                      sx={{
                        alignItems: "center",
                        display: "grid",
                        gap: 1.5,
                        gridTemplateColumns: { xs: "1fr", md: "56px minmax(0, 1fr) 120px 80px" },
                      }}
                    >
                      <Box
                        sx={(currentTheme) => ({
                          alignItems: "center",
                          background: `linear-gradient(155deg, ${alpha(currentTheme.palette.primary.main, 0.16)} 0%, ${alpha(currentTheme.palette.secondary.main, 0.12)} 100%)`,
                          border: `1px solid ${alpha(currentTheme.palette.divider, 0.82)}`,
                          borderRadius: 2,
                          display: "flex",
                          height: 56,
                          justifyContent: "center",
                          width: 56,
                        })}
                      >
                        <Typography sx={{ fontWeight: 800 }} variant="body2">
                          {buildProductThumbnailLabel(row)}
                        </Typography>
                      </Box>
                      <Stack minWidth={0} spacing={0.35}>
                        <Typography sx={{ fontWeight: 800 }} variant="body2">
                          {row.merchantSku}
                        </Typography>
                        <Typography sx={{ fontWeight: 700, lineHeight: 1.3 }} variant="body2">
                          {row.productName || row.merchantSku}
                        </Typography>
                        <Typography color="text.secondary" sx={{ lineHeight: 1.3 }} variant="caption">
                          {getBarcodeValue(row)} • {row.warehouseName || "Inventory"} • {row.shelf || "N/A"}
                        </Typography>
                      </Stack>
                      <TextField
                        fullWidth
                        label={t("Qty")}
                        onChange={(event) => handleQuantityChange(row.id, event.target.value)}
                        size="small"
                        type="number"
                        value={quantities[row.id] ?? 0}
                      />
                      <IconButton
                        aria-label={t("Remove")}
                        color="inherit"
                        onClick={() => handleRemoveRow(row.id)}
                        size="small"
                        sx={(currentTheme) => ({
                          backgroundColor: "transparent",
                          boxShadow: `0 0 0 1px ${alpha(currentTheme.palette.error.main, 0.14)}`,
                          color: currentTheme.palette.error.main,
                          justifySelf: { xs: "flex-start", md: "center" },
                          transition: currentTheme.transitions.create(["background-color", "box-shadow"], {
                            duration: currentTheme.transitions.duration.shorter,
                          }),
                          "&:hover": {
                            backgroundColor: "transparent",
                            boxShadow: `0 0 0 4px ${alpha(currentTheme.palette.error.main, 0.18)}, 0 10px 24px -12px ${alpha(currentTheme.palette.error.main, 0.9)}`,
                          },
                        })}
                      >
                        <DeleteOutlineRoundedIcon />
                      </IconButton>
                    </Box>
                  </Box>
                ))}
                {visibleRows.length === 0 ? (
                  <Box sx={{ px: 2, py: 3 }}>
                    <Typography color="text.secondary" variant="body2">
                      {t("Every selected row has been removed from this print batch.")}
                    </Typography>
                  </Box>
                ) : null}
              </Stack>
            </Box>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          {t("Cancel")}
        </Button>
        <Button
          disabled={isGeneratingPdf}
          onClick={() => {
            void handlePrint();
          }}
          startIcon={<LocalPrintshopOutlinedIcon />}
          variant="contained"
        >
          {isGeneratingPdf ? t("Generating Print...") : t("Print")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
