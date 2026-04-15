import { useEffect, useMemo, useState, type MouseEvent } from "react";

import ViewColumnOutlinedIcon from "@mui/icons-material/ViewColumnOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import {
  Button,
  Divider,
  List,
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
  loadHiddenTableColumnKeys,
  persistHiddenTableColumnKeys,
} from "@/shared/storage/table-column-visibility-storage";

export interface TableColumnVisibilityCapableColumn {
  key: string;
  header: TranslatableText;
  columnVisibilityLabel?: TranslatableText;
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
  key: string;
  label: TranslatableText;
  visible: boolean;
}

interface TableColumnVisibilityControlProps {
  items: TableColumnVisibilityItem[];
  onReset: () => void;
  onToggle: (key: string) => void;
  resetLabel?: TranslatableText;
  title?: TranslatableText;
  triggerLabel?: TranslatableText;
}

function buildColumnVisibilitySignature(columns: TableColumnVisibilityCapableColumn[]) {
  return JSON.stringify(
    columns.map((column) => [column.key, column.hideable !== false, column.defaultVisible !== false]),
  );
}

function buildDefaultHiddenColumnKeys(columns: TableColumnVisibilityCapableColumn[]) {
  const defaultHiddenColumnKeys = columns
    .filter((column) => column.hideable !== false && column.defaultVisible === false)
    .map((column) => column.key);
  const hideableColumnCount = columns.filter((column) => column.hideable !== false).length;

  return defaultHiddenColumnKeys.length >= hideableColumnCount ? [] : defaultHiddenColumnKeys;
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

function resolveHiddenColumnKeys(
  columns: TableColumnVisibilityCapableColumn[],
  storageKey?: string,
) {
  const defaultHiddenColumnKeys = buildDefaultHiddenColumnKeys(columns);
  if (!storageKey) {
    return defaultHiddenColumnKeys;
  }

  const persistedHiddenColumnKeys = loadHiddenTableColumnKeys(storageKey);
  return normalizeHiddenColumnKeys(persistedHiddenColumnKeys ?? defaultHiddenColumnKeys, columns);
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
  const isEnabled =
    (options?.enabled ?? true)
    && (hideableColumns.length > 1 || stableColumns.some((column) => column.defaultVisible === false));
  const [hiddenColumnKeys, setHiddenColumnKeys] = useState<string[]>(() =>
    isEnabled ? resolveHiddenColumnKeys(stableColumns, options?.storageKey) : [],
  );

  useEffect(() => {
    if (!isEnabled) {
      setHiddenColumnKeys([]);
      return;
    }

    setHiddenColumnKeys(resolveHiddenColumnKeys(stableColumns, options?.storageKey));
  }, [columnSignature, isEnabled, options?.storageKey, stableColumns]);

  useEffect(() => {
    if (!isEnabled || !options?.storageKey) {
      return;
    }

    persistHiddenTableColumnKeys(options.storageKey, hiddenColumnKeys);
  }, [hiddenColumnKeys, isEnabled, options?.storageKey]);

  const hiddenColumnKeySet = useMemo(() => new Set(hiddenColumnKeys), [hiddenColumnKeys]);
  const visibleColumns = useMemo(
    () => stableColumns.filter((column) => !hiddenColumnKeySet.has(column.key)),
    [stableColumns, hiddenColumnKeySet],
  );
  const visibleHideableColumnCount = hideableColumns.filter((column) => !hiddenColumnKeySet.has(column.key)).length;
  const items = useMemo<TableColumnVisibilityItem[]>(
    () =>
      stableColumns.map((column) => {
        const visible = !hiddenColumnKeySet.has(column.key);
        const canToggle =
          column.hideable !== false && (!visible || visibleHideableColumnCount > 1);

        return {
          canToggle,
          key: column.key,
          label: column.columnVisibilityLabel ?? column.header,
          visible,
        };
      }),
    [hiddenColumnKeySet, stableColumns, visibleHideableColumnCount],
  );

  return {
    enabled: isEnabled,
    items,
    resetToDefaults: () => {
      setHiddenColumnKeys(buildDefaultHiddenColumnKeys(stableColumns));
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
    visibleColumns,
  };
}

export function TableColumnVisibilityControl({
  items,
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
              <ListItemButton
                disabled={!item.canToggle}
                key={item.key}
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
                <ListItemIcon sx={{ color: item.visible ? "text.primary" : "text.secondary", minWidth: 0 }}>
                  {item.visible ? <VisibilityOutlinedIcon fontSize="small" /> : <VisibilityOffOutlinedIcon fontSize="small" />}
                </ListItemIcon>
              </ListItemButton>
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
