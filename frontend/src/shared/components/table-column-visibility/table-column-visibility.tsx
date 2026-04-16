import { useEffect, useMemo, useState, type MouseEvent } from "react";

import ArrowDownwardOutlinedIcon from "@mui/icons-material/ArrowDownwardOutlined";
import ArrowUpwardOutlinedIcon from "@mui/icons-material/ArrowUpwardOutlined";
import ViewColumnOutlinedIcon from "@mui/icons-material/ViewColumnOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import {
  Box,
  Button,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Popover,
  Stack,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import type { TranslatableText } from "@/app/i18n";
import { useI18n } from "@/app/ui-preferences";
import { ActionIconButton } from "@/shared/components/action-icon-button";
import {
  loadTableColumnConfiguration,
  persistTableColumnConfiguration,
} from "@/shared/storage/table-column-visibility-storage";

export type TableColumnOrderLock = "start" | "end";

export interface TableColumnVisibilityCapableColumn {
  key: string;
  header: TranslatableText;
  columnVisibilityLabel?: TranslatableText;
  columnOrderLock?: TableColumnOrderLock;
  defaultVisible?: boolean;
  hideable?: boolean;
}

export interface TableColumnVisibilityOptions {
  enabled?: boolean;
  menuTitle?: TranslatableText;
  resetLabel?: TranslatableText;
  storageKey?: string;
  triggerLabel?: TranslatableText;
}

export interface TableColumnVisibilityItem {
  canToggle: boolean;
  canMoveEarlier: boolean;
  canMoveLater: boolean;
  key: string;
  label: TranslatableText;
  visible: boolean;
}

interface TableColumnVisibilityControlProps {
  items: TableColumnVisibilityItem[];
  onMoveEarlier: (key: string) => void;
  onMoveLater: (key: string) => void;
  onReset: () => void;
  onToggle: (key: string) => void;
  resetLabel?: TranslatableText;
  title?: TranslatableText;
  triggerLabel?: TranslatableText;
}

function buildColumnVisibilitySignature(columns: TableColumnVisibilityCapableColumn[]) {
  return JSON.stringify(
    columns.map((column) => [
      column.key,
      column.hideable !== false,
      column.defaultVisible !== false,
      column.columnOrderLock ?? "",
    ]),
  );
}

function buildDefaultHiddenColumnKeys(columns: TableColumnVisibilityCapableColumn[]) {
  const defaultHiddenColumnKeys = columns
    .filter((column) => column.hideable !== false && column.defaultVisible === false)
    .map((column) => column.key);
  const hideableColumnCount = columns.filter((column) => column.hideable !== false).length;

  return defaultHiddenColumnKeys.length >= hideableColumnCount ? [] : defaultHiddenColumnKeys;
}

function buildDefaultOrderedColumnKeys(columns: TableColumnVisibilityCapableColumn[]) {
  return columns.map((column) => column.key);
}

function normalizeOrderedColumnKeys(
  orderedColumnKeys: string[],
  columns: TableColumnVisibilityCapableColumn[],
) {
  const availableColumnKeys = new Set(columns.map((column) => column.key));
  const seenColumnKeys = new Set<string>();
  const preservedColumnKeys = orderedColumnKeys.filter((columnKey) => {
    if (!availableColumnKeys.has(columnKey) || seenColumnKeys.has(columnKey)) {
      return false;
    }

    seenColumnKeys.add(columnKey);
    return true;
  });
  const baseOrderedColumnKeys = [
    ...preservedColumnKeys,
    ...columns.map((column) => column.key).filter((columnKey) => !seenColumnKeys.has(columnKey)),
  ];
  const leadingColumnKeySet = new Set(
    columns.filter((column) => column.columnOrderLock === "start").map((column) => column.key),
  );
  const trailingColumnKeySet = new Set(
    columns.filter((column) => column.columnOrderLock === "end").map((column) => column.key),
  );

  return [
    ...baseOrderedColumnKeys.filter((columnKey) => leadingColumnKeySet.has(columnKey)),
    ...baseOrderedColumnKeys.filter(
      (columnKey) => !leadingColumnKeySet.has(columnKey) && !trailingColumnKeySet.has(columnKey),
    ),
    ...baseOrderedColumnKeys.filter((columnKey) => trailingColumnKeySet.has(columnKey)),
  ];
}

function normalizeHiddenColumnKeys(
  hiddenColumnKeys: string[],
  columns: TableColumnVisibilityCapableColumn[],
) {
  const hideableColumns = columns.filter((column) => column.hideable !== false);
  const hideableColumnKeySet = new Set(hideableColumns.map((column) => column.key));
  const nextHiddenColumnKeys = hiddenColumnKeys.filter((columnKey) => hideableColumnKeySet.has(columnKey));

  if (hideableColumns.length === 0 || nextHiddenColumnKeys.length < hideableColumns.length) {
    return nextHiddenColumnKeys;
  }

  return nextHiddenColumnKeys.filter((columnKey) => columnKey !== hideableColumns[0]?.key);
}

function resolveTableColumnConfiguration(
  columns: TableColumnVisibilityCapableColumn[],
  storageKey?: string,
) {
  const defaultHiddenColumnKeys = buildDefaultHiddenColumnKeys(columns);
  const defaultOrderedColumnKeys = buildDefaultOrderedColumnKeys(columns);
  if (!storageKey) {
    return {
      hiddenColumnKeys: defaultHiddenColumnKeys,
      orderedColumnKeys: defaultOrderedColumnKeys,
    };
  }

  const persistedConfiguration = loadTableColumnConfiguration(storageKey);

  return {
    hiddenColumnKeys: normalizeHiddenColumnKeys(
      persistedConfiguration?.hiddenColumnKeys ?? defaultHiddenColumnKeys,
      columns,
    ),
    orderedColumnKeys: normalizeOrderedColumnKeys(
      persistedConfiguration?.orderedColumnKeys ?? defaultOrderedColumnKeys,
      columns,
    ),
  };
}

function resolveColumnOrderGroup(column: TableColumnVisibilityCapableColumn) {
  if (column.columnOrderLock === "start") {
    return "start";
  }
  if (column.columnOrderLock === "end") {
    return "end";
  }
  return "default";
}

function moveOrderedColumnKey(
  orderedColumnKeys: string[],
  columns: TableColumnVisibilityCapableColumn[],
  columnKey: string,
  direction: "earlier" | "later",
) {
  const normalizedOrderedColumnKeys = normalizeOrderedColumnKeys(orderedColumnKeys, columns);
  const columnMap = new Map(columns.map((column) => [column.key, column] as const));
  const currentIndex = normalizedOrderedColumnKeys.indexOf(columnKey);
  const currentColumn = columnMap.get(columnKey);

  if (currentIndex < 0 || !currentColumn) {
    return normalizedOrderedColumnKeys;
  }

  const targetGroup = resolveColumnOrderGroup(currentColumn);
  const groupOrderedColumnKeys = normalizedOrderedColumnKeys.filter((currentColumnKey) => {
    const matchingColumn = columnMap.get(currentColumnKey);
    return matchingColumn ? resolveColumnOrderGroup(matchingColumn) === targetGroup : false;
  });
  const groupIndex = groupOrderedColumnKeys.indexOf(columnKey);
  const swapWithColumnKey =
    direction === "earlier"
      ? groupOrderedColumnKeys[groupIndex - 1]
      : groupOrderedColumnKeys[groupIndex + 1];

  if (!swapWithColumnKey) {
    return normalizedOrderedColumnKeys;
  }

  const swapIndex = normalizedOrderedColumnKeys.indexOf(swapWithColumnKey);
  const nextOrderedColumnKeys = [...normalizedOrderedColumnKeys];
  [nextOrderedColumnKeys[currentIndex], nextOrderedColumnKeys[swapIndex]] = [
    nextOrderedColumnKeys[swapIndex],
    nextOrderedColumnKeys[currentIndex],
  ];

  return normalizeOrderedColumnKeys(nextOrderedColumnKeys, columns);
}

export function useTableColumnVisibility<TColumn extends TableColumnVisibilityCapableColumn>(
  columns: TColumn[],
  options?: TableColumnVisibilityOptions,
) {
  const columnSignature = useMemo(() => buildColumnVisibilitySignature(columns), [columns]);
  const stableColumns = useMemo(() => columns, [columnSignature]);
  const hideableColumns = useMemo(
    () => stableColumns.filter((column) => column.hideable !== false),
    [stableColumns],
  );
  const canConfigureOrder = stableColumns.length > 1;
  const canConfigureVisibility =
    hideableColumns.length > 1 || stableColumns.some((column) => column.defaultVisible === false);
  const isEnabled =
    (options?.enabled ?? true)
    && (canConfigureOrder || canConfigureVisibility);
  const [hiddenColumnKeys, setHiddenColumnKeys] = useState<string[]>(() =>
    isEnabled ? resolveTableColumnConfiguration(stableColumns, options?.storageKey).hiddenColumnKeys : [],
  );
  const [orderedColumnKeys, setOrderedColumnKeys] = useState<string[]>(() =>
    isEnabled ? resolveTableColumnConfiguration(stableColumns, options?.storageKey).orderedColumnKeys : [],
  );

  useEffect(() => {
    if (!isEnabled) {
      setHiddenColumnKeys([]);
      setOrderedColumnKeys(buildDefaultOrderedColumnKeys(stableColumns));
      return;
    }

    const configuration = resolveTableColumnConfiguration(stableColumns, options?.storageKey);
    setHiddenColumnKeys(configuration.hiddenColumnKeys);
    setOrderedColumnKeys(configuration.orderedColumnKeys);
  }, [columnSignature, isEnabled, options?.storageKey, stableColumns]);

  useEffect(() => {
    if (!isEnabled || !options?.storageKey) {
      return;
    }

    persistTableColumnConfiguration(options.storageKey, {
      hiddenColumnKeys,
      orderedColumnKeys,
    });
  }, [hiddenColumnKeys, isEnabled, options?.storageKey, orderedColumnKeys]);

  const hiddenColumnKeySet = useMemo(() => new Set(hiddenColumnKeys), [hiddenColumnKeys]);
  const orderedColumns = useMemo(() => {
    const columnMap = new Map(stableColumns.map((column) => [column.key, column] as const));
    return normalizeOrderedColumnKeys(orderedColumnKeys, stableColumns)
      .map((columnKey) => columnMap.get(columnKey))
      .filter((column): column is TColumn => Boolean(column));
  }, [orderedColumnKeys, stableColumns]);
  const visibleColumns = useMemo(
    () => orderedColumns.filter((column) => !hiddenColumnKeySet.has(column.key)),
    [orderedColumns, hiddenColumnKeySet],
  );
  const visibleHideableColumnCount = hideableColumns.filter((column) => !hiddenColumnKeySet.has(column.key)).length;
  const items = useMemo<TableColumnVisibilityItem[]>(
    () =>
      orderedColumns.map((column) => {
        const visible = !hiddenColumnKeySet.has(column.key);
        const canToggle =
          column.hideable !== false && (!visible || visibleHideableColumnCount > 1);
        const groupOrderedColumns = orderedColumns.filter(
          (currentColumn) => resolveColumnOrderGroup(currentColumn) === resolveColumnOrderGroup(column),
        );
        const groupIndex = groupOrderedColumns.findIndex((currentColumn) => currentColumn.key === column.key);

        return {
          canToggle,
          canMoveEarlier: groupIndex > 0,
          canMoveLater: groupIndex >= 0 && groupIndex < groupOrderedColumns.length - 1,
          key: column.key,
          label: column.columnVisibilityLabel ?? column.header,
          visible,
        };
      }),
    [hiddenColumnKeySet, orderedColumns, visibleHideableColumnCount],
  );

  return {
    enabled: isEnabled,
    items,
    resetToDefaults: () => {
      setHiddenColumnKeys(buildDefaultHiddenColumnKeys(stableColumns));
      setOrderedColumnKeys(buildDefaultOrderedColumnKeys(stableColumns));
    },
    toggleColumn: (columnKey: string) => {
      setHiddenColumnKeys((currentHiddenColumnKeys) => {
        const currentHiddenColumnKeySet = new Set(currentHiddenColumnKeys);
        if (currentHiddenColumnKeySet.has(columnKey)) {
          currentHiddenColumnKeySet.delete(columnKey);
        } else {
          currentHiddenColumnKeySet.add(columnKey);
        }

        return normalizeHiddenColumnKeys(Array.from(currentHiddenColumnKeySet), stableColumns);
      });
    },
    moveColumnEarlier: (columnKey: string) => {
      setOrderedColumnKeys((currentOrderedColumnKeys) =>
        moveOrderedColumnKey(currentOrderedColumnKeys, stableColumns, columnKey, "earlier"),
      );
    },
    moveColumnLater: (columnKey: string) => {
      setOrderedColumnKeys((currentOrderedColumnKeys) =>
        moveOrderedColumnKey(currentOrderedColumnKeys, stableColumns, columnKey, "later"),
      );
    },
    visibleColumns,
  };
}

export function TableColumnVisibilityControl({
  items,
  onMoveEarlier,
  onMoveLater,
  onReset,
  onToggle,
  resetLabel = "Restore default",
  title = "Column configuration",
  triggerLabel = "Configure columns",
}: TableColumnVisibilityControlProps) {
  const theme = useTheme();
  const { translate } = useI18n();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  return (
    <>
      <ActionIconButton
        aria-label={translate(triggerLabel)}
        onClick={(event: MouseEvent<HTMLButtonElement>) => setAnchorEl(event.currentTarget)}
        title={translate(triggerLabel)}
        tone="neutral"
      >
        <ViewColumnOutlinedIcon fontSize="small" />
      </ActionIconButton>
      <Popover
        anchorEl={anchorEl}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        onClose={() => setAnchorEl(null)}
        open={open}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        slotProps={{
          paper: {
            sx: {
              border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
              borderRadius: 3,
              boxShadow:
                theme.palette.mode === "dark"
                  ? `0 18px 40px ${alpha(theme.palette.common.black, 0.42)}`
                  : `0 18px 38px ${alpha(theme.palette.common.black, 0.14)}`,
              maxWidth: 320,
              minWidth: 264,
              mt: 1,
              overflow: "hidden",
            },
          },
        }}
      >
        <Stack spacing={0}>
          <Stack spacing={0.5} sx={{ px: 2, py: 1.75 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 800 }} variant="body2">
              {translate(title)}
            </Typography>
          </Stack>
          <Divider />
          <List disablePadding sx={{ py: 0.5 }}>
            {items.map((item) => (
              <ListItem
                disablePadding
                key={item.key}
                secondaryAction={
                  <Stack direction="row" spacing={0.5}>
                    <ActionIconButton
                      aria-label={`Move ${translate(item.label)} earlier`}
                      disabled={!item.canMoveEarlier}
                      onClick={() => onMoveEarlier(item.key)}
                      size="small"
                      title={`Move ${translate(item.label)} earlier`}
                    >
                      <ArrowUpwardOutlinedIcon fontSize="small" />
                    </ActionIconButton>
                    <ActionIconButton
                      aria-label={`Move ${translate(item.label)} later`}
                      disabled={!item.canMoveLater}
                      onClick={() => onMoveLater(item.key)}
                      size="small"
                      title={`Move ${translate(item.label)} later`}
                    >
                      <ArrowDownwardOutlinedIcon fontSize="small" />
                    </ActionIconButton>
                  </Stack>
                }
                sx={{
                  pr: 10.5,
                }}
              >
                <ListItemButton
                  disabled={!item.canToggle}
                  onClick={() => onToggle(item.key)}
                  sx={{
                    gap: 1,
                    py: 1,
                  }}
                >
                  <ListItemText
                    primary={translate(item.label)}
                    primaryTypographyProps={{
                      sx: {
                        color: item.visible ? "text.primary" : "text.secondary",
                        fontSize: 13,
                        fontWeight: item.visible ? 600 : 500,
                      },
                    }}
                  />
                  <Box sx={{ alignItems: "center", display: "inline-flex", minWidth: 0 }}>
                    <ListItemIcon sx={{ color: item.visible ? "text.primary" : "text.secondary", minWidth: 0 }}>
                      {item.visible ? <VisibilityOutlinedIcon fontSize="small" /> : <VisibilityOffOutlinedIcon fontSize="small" />}
                    </ListItemIcon>
                  </Box>
                </ListItemButton>
              </ListItem>
            ))}
          </List>
          <Divider />
          <Stack alignItems="flex-start" sx={{ px: 2, py: 1.5 }}>
            <Button onClick={onReset} size="small" variant="outlined">
              {translate(resetLabel)}
            </Button>
          </Stack>
        </Stack>
      </Popover>
    </>
  );
}
