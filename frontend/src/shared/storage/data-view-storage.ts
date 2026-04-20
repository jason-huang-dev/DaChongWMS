type DataViewFilterMap = Record<string, string>;

const storageKeyPrefix = "dachongwms.data-views";

export interface SavedDataView<TFilters extends DataViewFilterMap = DataViewFilterMap> {
  id: string;
  name: string;
  filters: TFilters;
  createdAt?: string;
  updatedAt?: string;
}

function isBrowserEnvironment() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function buildStorageKey(viewKey: string) {
  return `${storageKeyPrefix}.${viewKey}`;
}

function normalizeFilters<TFilters extends DataViewFilterMap>(value: unknown): TFilters | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const normalizedEntries = Object.entries(value).map(([key, filterValue]) => [
    key,
    typeof filterValue === "string" ? filterValue : String(filterValue ?? ""),
  ]);

  return Object.fromEntries(normalizedEntries) as TFilters;
}

function normalizeSavedView<TFilters extends DataViewFilterMap>(
  value: unknown,
): SavedDataView<TFilters> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Partial<SavedDataView<TFilters>>;
  const id = typeof record.id === "string" ? record.id.trim() : "";
  const name = typeof record.name === "string" ? record.name.trim() : "";
  const filters = normalizeFilters<TFilters>(record.filters);

  if (!id || !name || !filters) {
    return null;
  }

  return {
    id,
    name,
    filters,
    createdAt: typeof record.createdAt === "string" ? record.createdAt : undefined,
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : undefined,
  };
}

export function loadSavedDataViews<TFilters extends DataViewFilterMap>(
  viewKey: string,
): SavedDataView<TFilters>[] {
  if (!isBrowserEnvironment()) {
    return [];
  }

  const storageKey = buildStorageKey(viewKey);
  const rawValue = window.localStorage.getItem(storageKey);
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (!Array.isArray(parsed)) {
      window.localStorage.removeItem(storageKey);
      return [];
    }

    const normalizedViews = parsed
      .map((item) => normalizeSavedView<TFilters>(item))
      .filter((item): item is SavedDataView<TFilters> => item !== null);

    if (normalizedViews.length !== parsed.length) {
      persistSavedDataViews(viewKey, normalizedViews);
    }

    return normalizedViews;
  } catch {
    window.localStorage.removeItem(storageKey);
    return [];
  }
}

export function persistSavedDataViews<TFilters extends DataViewFilterMap>(
  viewKey: string,
  views: SavedDataView<TFilters>[],
): void {
  if (!isBrowserEnvironment()) {
    return;
  }

  const storageKey = buildStorageKey(viewKey);
  const normalizedViews = views
    .map((view) => normalizeSavedView<TFilters>(view))
    .filter((view): view is SavedDataView<TFilters> => view !== null);

  if (normalizedViews.length === 0) {
    window.localStorage.removeItem(storageKey);
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(normalizedViews));
}

export function clearSavedDataViews(viewKey: string): void {
  if (!isBrowserEnvironment()) {
    return;
  }

  window.localStorage.removeItem(buildStorageKey(viewKey));
}