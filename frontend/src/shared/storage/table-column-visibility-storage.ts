const storageKeyPrefix = "dachongwms.table-column-visibility.";

interface StoredTableColumnVisibilitySnapshot {
  hiddenColumnKeys: string[];
  orderedColumnKeys?: string[];
}

export interface TableColumnConfigurationSnapshot {
  hiddenColumnKeys: string[];
  orderedColumnKeys: string[] | null;
}

function canUseLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function buildStorageKey(storageKey: string) {
  return `${storageKeyPrefix}${storageKey}`;
}

export function loadHiddenTableColumnKeys(storageKey: string) {
  return loadTableColumnConfiguration(storageKey)?.hiddenColumnKeys ?? null;
}

export function loadTableColumnConfiguration(storageKey: string): TableColumnConfigurationSnapshot | null {
  if (!canUseLocalStorage()) {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(buildStorageKey(storageKey));
    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue) as StoredTableColumnVisibilitySnapshot;
    const hiddenColumnKeys = Array.isArray(parsedValue.hiddenColumnKeys)
      ? parsedValue.hiddenColumnKeys.filter((value): value is string => typeof value === "string")
      : null;
    const orderedColumnKeys = Array.isArray(parsedValue.orderedColumnKeys)
      ? parsedValue.orderedColumnKeys.filter((value): value is string => typeof value === "string")
      : null;

    if (!hiddenColumnKeys) {
      return null;
    }

    return {
      hiddenColumnKeys,
      orderedColumnKeys,
    };
  } catch {
    window.localStorage.removeItem(buildStorageKey(storageKey));
    return null;
  }
}

export function persistHiddenTableColumnKeys(storageKey: string, hiddenColumnKeys: string[]) {
  persistTableColumnConfiguration(storageKey, {
    hiddenColumnKeys,
    orderedColumnKeys: null,
  });
}

export function persistTableColumnConfiguration(
  storageKey: string,
  snapshot: TableColumnConfigurationSnapshot,
) {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.setItem(
    buildStorageKey(storageKey),
    JSON.stringify({
      hiddenColumnKeys: snapshot.hiddenColumnKeys,
      orderedColumnKeys: snapshot.orderedColumnKeys ?? undefined,
    } satisfies StoredTableColumnVisibilitySnapshot),
  );
}
