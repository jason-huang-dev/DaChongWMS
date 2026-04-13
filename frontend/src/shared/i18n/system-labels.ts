import type { TranslationKey } from "@/app/i18n";
import { findTranslationKey } from "@/app/i18n";
import { formatStatusLabel } from "@/shared/utils/format";

const staffRoleLabelKeys: Record<string, TranslationKey> = {
  Finance: "Finance",
  Inbound: "Inbound",
  Manager: "Manager",
  Outbound: "Outbound",
  StockControl: "StockControl",
  Supervisor: "Supervisor",
};

export function getStaffRoleLabelKey(value?: string | null): TranslationKey | null {
  if (!value) {
    return null;
  }

  return staffRoleLabelKeys[value] ?? findTranslationKey(formatStatusLabel(value));
}

export function getStatusLabelKey(value?: string | null): TranslationKey | null {
  if (!value) {
    return null;
  }

  return findTranslationKey(formatStatusLabel(value));
}
