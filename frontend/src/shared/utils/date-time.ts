export function toDateTimeLocalInputValue(value?: string | null): string {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value.replace(" ", "T").slice(0, 16);
  }

  const shifted = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

export function toNullableDateTime(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
