export interface CsvEscapeOptions {
  protectSpreadsheetFormulas?: boolean;
}

const spreadsheetFormulaPattern = /^[=+\-@]/u;

export function escapeCsvValue(
  value: string | number | boolean | null | undefined,
  options: CsvEscapeOptions = {},
) {
  const rawValue = String(value ?? "");
  const protectSpreadsheetFormulas = options.protectSpreadsheetFormulas ?? true;
  const sanitizedValue =
    protectSpreadsheetFormulas && spreadsheetFormulaPattern.test(rawValue) ? `'${rawValue}` : rawValue;

  return `"${sanitizedValue.replace(/"/g, '""')}"`;
}

export function downloadCsvFile(csvContent: string, filename: string) {
  if (typeof document === "undefined" || typeof URL.createObjectURL !== "function") {
    return false;
  }

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  return true;
}
