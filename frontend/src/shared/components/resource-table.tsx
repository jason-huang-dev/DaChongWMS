import type { ReactNode } from "react";

import {
  Alert,
  Box,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import { brandColors, brandMotion } from "@/app/brand";
import { useI18n } from "@/app/ui-preferences";

interface ColumnDefinition<TRow> {
  key: string;
  header: string;
  align?: "left" | "right" | "center";
  headerAlign?: "left" | "right" | "center";
  headerTooltip?: string;
  fitContent?: boolean;
  minWidth?: number | string;
  nowrap?: boolean;
  wrapHeader?: boolean;
  sortKey?: string;
  width?: number | string;
  render: (row: TRow) => ReactNode;
}

interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export interface ResourceTableRowSelection<TRow> {
  selectedRowIds: Array<string | number>;
  onToggleRow: (row: TRow) => void;
  onToggleAll: (rows: TRow[]) => void;
  isRowSelectable?: (row: TRow) => boolean;
}

interface ResourceTableProps<TRow> {
  title?: string;
  subtitle?: string;
  rows: TRow[];
  columns: ColumnDefinition<TRow>[];
  getRowId: (row: TRow) => string | number;
  isLoading?: boolean;
  error?: string | null;
  pagination?: PaginationState;
  emptyMessage?: string;
  toolbar?: ReactNode;
  rowSelection?: ResourceTableRowSelection<TRow>;
  tableBorderRadius?: number | string;
  compact?: boolean;
  allowHorizontalScroll?: boolean;
  sorting?: {
    direction: "asc" | "desc";
    onSortChange: (sortKey: string) => void;
    sortKey: string;
  };
}

export function ResourceTable<TRow>({
  title,
  subtitle,
  rows,
  columns,
  getRowId,
  isLoading,
  error,
  pagination,
  emptyMessage = "No records found.",
  toolbar,
  rowSelection,
  tableBorderRadius = 3,
  compact = false,
  allowHorizontalScroll = false,
  sorting,
}: ResourceTableProps<TRow>) {
  const selectionColumnWidth = compact ? 36 : 44;
  const defaultCompactCellPaddingX = compact ? 1.25 : undefined;
  const fitContentCompactCellPaddingX = compact ? 0.875 : undefined;
  const theme = useTheme();
  const { locale, translateText } = useI18n();
  const isDark = theme.palette.mode === "dark";
  const isChineseLocale = locale === "zh-CN";
  const compactHeaderFontSize = compact ? "0.6rem" : 12;
  const usesFixedTableLayout = allowHorizontalScroll && (Boolean(rowSelection) || columns.some((column) => column.width));
  const selectableRows = rowSelection
    ? rows.filter((row) => (rowSelection.isRowSelectable ? rowSelection.isRowSelectable(row) : true))
    : [];
  const selectableIds = selectableRows.map((row) => getRowId(row));
  const selectedSelectableCount = selectableIds.filter((id) => rowSelection?.selectedRowIds.includes(id)).length;
  const allSelected = selectableIds.length > 0 && selectedSelectableCount === selectableIds.length;
  const partiallySelected = selectedSelectableCount > 0 && !allSelected;

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          {title || subtitle ? (
            <Box>
              {title ? <Typography variant="h6">{translateText(title)}</Typography> : null}
              {subtitle ? (
                <Typography color="text.secondary" variant="body2">
                  {translateText(subtitle)}
                </Typography>
              ) : null}
            </Box>
          ) : null}
          {toolbar}
          {error ? <Alert severity="error">{error}</Alert> : null}
          <TableContainer
            sx={{
              border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
              borderRadius: tableBorderRadius,
              overflowX: allowHorizontalScroll ? "auto" : "hidden",
              overflowY: "hidden",
            }}
          >
            <Table
              size="small"
              sx={
                allowHorizontalScroll
                  ? {
                      tableLayout: usesFixedTableLayout ? "fixed" : "auto",
                      width: "100%",
                    }
                  : undefined
              }
            >
              {usesFixedTableLayout ? (
                <colgroup>
                  {rowSelection ? <col style={{ width: selectionColumnWidth }} /> : null}
                  {columns.map((column) => (
                    <col key={column.key} style={column.width ? { width: column.width } : undefined} />
                  ))}
                </colgroup>
              ) : null}
              <TableHead>
                <TableRow
                  sx={{
                    backgroundColor: alpha(theme.palette.text.primary, isDark ? 0.05 : 0.03),
                  }}
                >
                  {rowSelection ? (
                    <TableCell
                      padding="none"
                      sx={{
                        borderBottomColor: alpha(theme.palette.divider, 0.8),
                        boxSizing: "border-box",
                        maxWidth: selectionColumnWidth,
                        minWidth: selectionColumnWidth,
                        px: compact ? 0.25 : 0.5,
                        textAlign: "center",
                        verticalAlign: "middle",
                        width: selectionColumnWidth,
                      }}
                    >
                      <Checkbox
                        checked={allSelected}
                        disabled={selectableRows.length === 0}
                        indeterminate={partiallySelected}
                        onChange={() => rowSelection.onToggleAll(selectableRows)}
                        size="small"
                        sx={{ display: "block", mx: "auto", p: compact ? 0.25 : 0.5 }}
                      />
                    </TableCell>
                  ) : null}
                  {columns.map((column) => (
                    <TableCell
                      align={column.headerAlign ?? column.align}
                      key={column.key}
                      sx={{
                        borderBottomColor: alpha(theme.palette.divider, 0.8),
                        color: theme.palette.text.secondary,
                        fontSize: compactHeaderFontSize,
                        fontWeight: 800,
                        letterSpacing: isChineseLocale ? 0 : compact ? theme.typography.overline.letterSpacing : "0.08em",
                        lineHeight: column.wrapHeader ? 1.3 : undefined,
                        minWidth: column.minWidth,
                        px: column.fitContent ? fitContentCompactCellPaddingX : defaultCompactCellPaddingX,
                        py: compact ? 1 : undefined,
                        textAlign: column.headerAlign ?? column.align,
                        whiteSpace: column.wrapHeader ? "normal" : column.nowrap ? "nowrap" : undefined,
                        width: column.width,
                        textTransform: isChineseLocale ? "none" : "uppercase",
                      }}
                    >
                      {column.headerTooltip ? (
                        <Tooltip enterDelay={200} title={translateText(column.headerTooltip)}>
                          <Box component="span" sx={{ display: "block", width: "100%" }}>
                            {sorting && column.sortKey ? (
                              <TableSortLabel
                                active={sorting.sortKey === column.sortKey}
                                direction={sorting.sortKey === column.sortKey ? sorting.direction : "asc"}
                                hideSortIcon={sorting.sortKey !== column.sortKey}
                                onClick={() => sorting.onSortChange(column.sortKey!)}
                                sx={{
                                  display: "inline-flex",
                                  fontSize: "inherit",
                                  justifyContent:
                                    (column.headerAlign ?? column.align) === "right"
                                      ? "flex-end"
                                      : (column.headerAlign ?? column.align) === "center"
                                        ? "center"
                                        : "flex-start",
                                  letterSpacing: "inherit",
                                  lineHeight: column.wrapHeader ? 1.3 : undefined,
                                  textAlign: column.headerAlign ?? column.align,
                                  textTransform: "inherit",
                                  whiteSpace: column.wrapHeader ? "normal" : "nowrap",
                                  width: "100%",
                                  "& .MuiTableSortLabel-icon": {
                                    marginLeft: isChineseLocale ? "2px" : undefined,
                                  },
                                }}
                              >
                                {translateText(column.header)}
                              </TableSortLabel>
                            ) : (
                              translateText(column.header)
                            )}
                          </Box>
                        </Tooltip>
                      ) : sorting && column.sortKey ? (
                        <TableSortLabel
                          active={sorting.sortKey === column.sortKey}
                          direction={sorting.sortKey === column.sortKey ? sorting.direction : "asc"}
                          hideSortIcon={sorting.sortKey !== column.sortKey}
                          onClick={() => sorting.onSortChange(column.sortKey!)}
                          sx={{
                            display: "inline-flex",
                            fontSize: "inherit",
                            justifyContent:
                              (column.headerAlign ?? column.align) === "right"
                                ? "flex-end"
                                : (column.headerAlign ?? column.align) === "center"
                                  ? "center"
                                  : "flex-start",
                            letterSpacing: "inherit",
                            lineHeight: column.wrapHeader ? 1.3 : undefined,
                            textAlign: column.headerAlign ?? column.align,
                            textTransform: "inherit",
                            whiteSpace: column.wrapHeader ? "normal" : "nowrap",
                            width: "100%",
                            "& .MuiTableSortLabel-icon": {
                              marginLeft: isChineseLocale ? "2px" : undefined,
                            },
                          }}
                        >
                          {translateText(column.header)}
                        </TableSortLabel>
                      ) : (
                        translateText(column.header)
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={columns.length + (rowSelection ? 1 : 0)}>
                      <Stack alignItems="center" direction="row" justifyContent="center" spacing={1.5} sx={{ py: 4 }}>
                        <CircularProgress size={20} />
                        <Typography variant="body2">{translateText("Loading data...")}</Typography>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length + (rowSelection ? 1 : 0)}>
                      <Typography color="text.secondary" sx={{ py: 3 }} textAlign="center" variant="body2">
                        {translateText(emptyMessage)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row, index) => {
                    const rowId = getRowId(row);
                    const isSelected = rowSelection ? rowSelection.selectedRowIds.includes(rowId) : false;
                    const canSelect = rowSelection ? (rowSelection.isRowSelectable ? rowSelection.isRowSelectable(row) : true) : false;

                    return (
                      <TableRow
                        hover
                        key={rowId}
                        sx={{
                          "& td": {
                            backgroundColor: isSelected
                              ? alpha(brandColors.accent, isDark ? 0.12 : 0.08)
                              : index % 2 === 0
                                ? alpha(theme.palette.background.paper, isDark ? 0.92 : 0.98)
                                : alpha(theme.palette.text.primary, isDark ? 0.02 : 0.015),
                            borderBottomColor: alpha(theme.palette.divider, 0.62),
                            transition: [
                              `background-color ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                              `box-shadow ${brandMotion.duration.standard} ${brandMotion.easing.standard}`,
                            ].join(", "),
                          },
                          "& td:first-of-type": {
                            boxShadow: isSelected ? `inset 3px 0 0 ${brandColors.accent}` : "none",
                          },
                          "&:hover td": {
                            backgroundColor: isSelected
                              ? alpha(brandColors.accent, isDark ? 0.16 : 0.1)
                              : alpha(theme.palette.text.primary, isDark ? 0.06 : 0.04),
                          },
                          opacity: rowSelection && !canSelect ? 0.68 : 1,
                        }}
                      >
                        {rowSelection ? (
                          <TableCell
                            padding="none"
                            sx={{
                              boxSizing: "border-box",
                              maxWidth: selectionColumnWidth,
                              minWidth: selectionColumnWidth,
                              px: compact ? 0.25 : 0.5,
                              textAlign: "center",
                              verticalAlign: "middle",
                              width: selectionColumnWidth,
                            }}
                          >
                            <Checkbox
                              checked={isSelected}
                              disabled={!canSelect}
                              onChange={() => rowSelection.onToggleRow(row)}
                              size="small"
                              sx={{ display: "block", mx: "auto", p: compact ? 0.25 : 0.5 }}
                            />
                          </TableCell>
                        ) : null}
                        {columns.map((column) => (
                          <TableCell
                            align={column.align}
                            key={column.key}
                            sx={{
                              fontSize: compact ? theme.typography.body2.fontSize : 13,
                              lineHeight: compact ? theme.typography.body2.lineHeight : undefined,
                              minWidth: column.minWidth,
                              px: column.fitContent ? fitContentCompactCellPaddingX : defaultCompactCellPaddingX,
                              py: compact ? 1 : undefined,
                              verticalAlign: "middle",
                              whiteSpace: column.nowrap ? "nowrap" : undefined,
                              width: column.width,
                            }}
                          >
                            {column.render(row)}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
          {pagination ? (
            <TablePagination
              component="div"
              count={pagination.total}
              onPageChange={(_event, nextPage) => pagination.onPageChange(nextPage + 1)}
              onRowsPerPageChange={() => undefined}
              page={Math.max(pagination.page - 1, 0)}
              rowsPerPage={pagination.pageSize}
              rowsPerPageOptions={[pagination.pageSize]}
            />
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}
