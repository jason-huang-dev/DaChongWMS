import { useCallback, useEffect, useMemo, useState } from "react";

import { loadSavedDataViews, persistSavedDataViews, type SavedDataView } from "@/shared/storage/data-view-storage";

export type DataViewFilters = Record<string, string>;

interface UseDataViewOptions<TFilters extends DataViewFilters> {
  viewKey: string;
  defaultFilters: TFilters;
  pageSize?: number;
}

export interface UseDataViewResult<TFilters extends DataViewFilters> {
  page: number;
  pageSize: number;
  setPage: (page: number) => void;
  filters: TFilters;
  queryFilters: Record<string, string>;
  updateFilter: (key: keyof TFilters & string, value: string) => void;
  resetFilters: () => void;
  activeFilterCount: number;
  savedViews: SavedDataView<TFilters>[];
  selectedSavedViewId: string | null;
  applySavedView: (viewId: string) => void;
  saveCurrentView: (name: string) => void;
  deleteSavedView: (viewId: string) => void;
}

function normalizeFilters<TFilters extends DataViewFilters>(filters: TFilters) {
  return Object.entries(filters).reduce<Record<string, string>>((accumulator, [key, value]) => {
    const normalizedValue = value?.trim?.() ?? value;
    if (normalizedValue) {
      accumulator[key] = normalizedValue;
    }
    return accumulator;
  }, {});
}

function buildViewId() {
  return `view-${Math.random().toString(36).slice(2, 10)}`;
}

export function useDataView<TFilters extends DataViewFilters>({
  viewKey,
  defaultFilters,
  pageSize = 10,
}: UseDataViewOptions<TFilters>): UseDataViewResult<TFilters> {
  const defaultFiltersKey = JSON.stringify(defaultFilters);
  const stableDefaultFilters = useMemo(() => defaultFilters, [defaultFiltersKey]);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<TFilters>(stableDefaultFilters);
  const [savedViews, setSavedViews] = useState<SavedDataView<TFilters>[]>([]);
  const [selectedSavedViewId, setSelectedSavedViewId] = useState<string | null>(null);

  useEffect(() => {
    setFilters(stableDefaultFilters);
    setPage(1);
  }, [stableDefaultFilters, viewKey]);

  useEffect(() => {
    setSavedViews(loadSavedDataViews<TFilters>(viewKey));
  }, [viewKey]);

  useEffect(() => {
    persistSavedDataViews(viewKey, savedViews);
  }, [savedViews, viewKey]);

  useEffect(() => {
    const matchedView = savedViews.find(
      (view) => JSON.stringify(view.filters) === JSON.stringify(filters),
    );
    setSelectedSavedViewId(matchedView?.id ?? null);
  }, [filters, savedViews]);

  const updateFilter = useCallback((key: keyof TFilters & string, value: string) => {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [key]: value,
    }));
    setPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(stableDefaultFilters);
    setPage(1);
  }, [stableDefaultFilters]);

  const queryFilters = useMemo(() => normalizeFilters(filters), [filters]);

  const saveCurrentView = useCallback(
    (name: string) => {
      const normalizedName = name.trim();
      if (!normalizedName) {
        return;
      }

      const nextView: SavedDataView<TFilters> = {
        id: buildViewId(),
        name: normalizedName,
        filters,
      };

      setSavedViews((currentViews) => [...currentViews.filter((view) => view.name !== normalizedName), nextView]);
      setSelectedSavedViewId(nextView.id);
    },
    [filters],
  );

  const applySavedView = useCallback(
    (viewId: string) => {
      const savedView = savedViews.find((view) => view.id === viewId);
      if (!savedView) {
        return;
      }
      setFilters(savedView.filters);
      setPage(1);
    },
    [savedViews],
  );

  const deleteSavedView = useCallback((viewId: string) => {
    setSavedViews((currentViews) => currentViews.filter((view) => view.id !== viewId));
  }, []);

  return {
    page,
    pageSize,
    setPage,
    filters,
    queryFilters,
    updateFilter,
    resetFilters,
    activeFilterCount: Object.keys(queryFilters).length,
    savedViews,
    selectedSavedViewId,
    applySavedView,
    saveCurrentView,
    deleteSavedView,
  };
}
