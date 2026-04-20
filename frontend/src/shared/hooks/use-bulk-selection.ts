import { useCallback, useMemo, useState } from "react";

type SelectableId = number | string;

function uniqueIds<TId extends SelectableId>(ids: TId[]) {
  return Array.from(new Set(ids));
}

export function useBulkSelection<TId extends SelectableId>() {
  const [selectedIds, setSelectedIds] = useState<TId[]>([]);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const isSelected = useCallback(
    (id: TId) => selectedIds.includes(id),
    [selectedIds],
  );

  const toggleOne = useCallback((id: TId) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((currentId) => currentId !== id) : [...current, id],
    );
  }, []);

  const toggleMany = useCallback((ids: TId[]) => {
    const normalizedIds = uniqueIds(ids);
    if (normalizedIds.length === 0) {
      return;
    }

    setSelectedIds((current) => {
      const allSelected = normalizedIds.every((id) => current.includes(id));
      if (allSelected) {
        return current.filter((id) => !normalizedIds.includes(id));
      }
      return uniqueIds([...current, ...normalizedIds]);
    });
  }, []);

  return useMemo(
    () => ({
      clearSelection,
      isSelected,
      selectedCount: selectedIds.length,
      selectedIds,
      toggleMany,
      toggleOne,
    }),
    [clearSelection, isSelected, selectedIds, toggleMany, toggleOne],
  );
}
