import { getPreferredAppLocale } from "@/app/ui-preferences-storage";

export function formatDateTime(value?: string | null): string {
  if (!value) {
    return "--";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString(getPreferredAppLocale());
}

export function formatNumber(value?: string | number | null): string {
  if (value === undefined || value === null || value === "") {
    return "--";
  }
  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(numeric)) {
    return String(value);
  }
  return new Intl.NumberFormat(getPreferredAppLocale(), { maximumFractionDigits: 4 }).format(numeric);
}

export function formatStatusLabel(value?: string | null): string {
  if (!value) {
    return "--";
  }
  return value
    .toLowerCase()
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}
