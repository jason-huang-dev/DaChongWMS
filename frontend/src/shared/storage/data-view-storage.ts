export interface SavedDataView<TFilters extends Record<string, string>> {
  id: string;
  name: string;
  filters: TFilters;
}

function getStorageKey(viewKey: string) {
  return `dachongwms.views.${viewKey}`;
}

export function loadSavedDataViews<TFilters extends Record<string, string>>(viewKey: string): SavedDataView<TFilters>[] {
  try {
    const rawValue = window.localStorage.getItem(getStorageKey(viewKey));
    if (!rawValue) {
      return [];
    }
    const parsedValue = JSON.parse(rawValue) as SavedDataView<TFilters>[];
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch {
    return [];
  }
}

export function persistSavedDataViews<TFilters extends Record<string, string>>(
  viewKey: string,
  views: SavedDataView<TFilters>[],
) {
  try {
    window.localStorage.setItem(getStorageKey(viewKey), JSON.stringify(views));
  } catch {
    // Ignore storage failures. Views still function in-memory.
  }
}
