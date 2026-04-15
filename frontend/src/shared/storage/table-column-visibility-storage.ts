const storageKeyPrefix = "dachongwms.table-column-visibility.";

interface StoredTableColumnVisibilitySnapshot {
  hiddenColumnKeys: string[];
}

function canUseLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function buildStorageKey(storageKey: string) {
  return `${storageKeyPrefix}${storageKey}`;
}

export function loadHiddenTableColumnKeys(storageKey: string) {
  if (!canUseLocalStorage()) {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(buildStorageKey(storageKey));
    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue) as StoredTableColumnVisibilitySnapshot;
    return Array.isArray(parsedValue.hiddenColumnKeys)
      ? parsedValue.hiddenColumnKeys.filter((value): value is string => typeof value === "string")
      : null;
  } catch {
    window.localStorage.removeItem(buildStorageKey(storageKey));
    return null;
  }
}

export function persistHiddenTableColumnKeys(storageKey: string, hiddenColumnKeys: string[]) {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.setItem(
    buildStorageKey(storageKey),
    JSON.stringify({ hiddenColumnKeys } satisfies StoredTableColumnVisibilitySnapshot),
  );
}
