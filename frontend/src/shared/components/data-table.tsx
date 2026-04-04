import { Fragment, type ReactNode } from "react";

import {
  Alert,
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
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import { brandColors, brandMotion } from "@/app/brand";
import { useI18n } from "@/app/ui-preferences";

export interface DataTableColumnDefinition<TRow, TSortKey extends string = string> {
  key: string;
  header: string;
  align?: "left" | "right" | "center";
  minWidth?: number | string;
  sortKey?: TSortKey;
  width?: number | string;
  render: (row: TRow) => ReactNode;
}

interface DataTablePaginationState {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export interface DataTableRowSelection<TRow> {
  selectedRowIds: Array<string | number>;
  onToggleRow: (row: TRow) => void;
  onToggleAll: (rows: TRow[]) => void;
  isRowSelectable?: (row: TRow) => boolean;
}

interface DataTableProps<TRow, TSortKey extends string = string> {
  rows: TRow[];
  columns: DataTableColumnDefinition<TRow, TSortKey>[];
  getRowId: (row: TRow) => string | number;
  isLoading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  toolbar?: ReactNode;
  pagination?: DataTablePaginationState;
  rowSelection?: DataTableRowSelection<TRow>;
  renderMetaRow?: (row: TRow) => ReactNode;
  selectionColumnWidth?: number;
  sorting?: {
    direction: "asc" | "desc";
    onSortChange: (sortKey: TSortKey) => void;
    sortKey: TSortKey;
  };
}

export function DataTable<TRow, TSortKey extends string = string>({
  rows,
  columns,
  getRowId,
  isLoading = false,
  error,
  emptyMessage = "No records found.",
  toolbar,
  pagination,
  rowSelection,
  renderMetaRow,
  selectionColumnWidth = 44,
  sorting,
}: DataTableProps<TRow, TSortKey>) {
  const theme = useTheme();
  const { t, translateText } = useI18n();
  const isDark = theme.palette.mode === "dark";
  const selectableRows = rowSelection
    ? rows.filter((row) => (rowSelection.isRowSelectable ? rowSelection.isRowSelectable(row) : true))
    : [];
  const selectableIds = selectableRows.map((row) => getRowId(row));
  const selectedSelectableCount = selectableIds.filter((id) => rowSelection?.selectedRowIds.includes(id)).length;
  const allSelected = selectableIds.length > 0 && selectedSelectableCount === selectableIds.length;
  const partiallySelected = selectedSelectableCount > 0 && !allSelected;

  return (
    <Card>
      <CardContent sx={{ pb: 1.5 }}>
        <Stack spacing={2}>
          {toolbar}
          {error ? <Alert severity="error">{error}</Alert> : null}

          <TableContainer
            sx={{
              border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
              borderRadius: 1.5,
              overflowX: "auto",
              overflowY: "hidden",
            }}
          >
            <Table size="small" sx={{ tableLayout: "fixed", width: "100%" }}>
              <colgroup>
                {rowSelection ? <col style={{ width: selectionColumnWidth }} /> : null}
                {columns.map((column) => (
                  <col key={column.key} style={column.width ? { width: column.width } : undefined} />
                ))}
              </colgroup>
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
                        px: 0.5,
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
                        sx={{ display: "block", mx: "auto", p: 0.5 }}
                      />
                    </TableCell>
                  ) : null}
                  {columns.map((column) => (
                    <TableCell
                      align={column.align}
                      key={column.key}
                      sx={{
                        borderBottomColor: alpha(theme.palette.divider, 0.8),
                        color: theme.palette.text.primary,
                        fontSize: theme.typography.body2.fontSize,
                        fontWeight: 800,
                        lineHeight: 1.3,
                        minWidth: column.minWidth,
                        px: 1.25,
                        py: 1.2,
                        textAlign: column.align,
                        whiteSpace: "normal",
                        width: column.width,
                      }}
                    >
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
                              column.align === "right"
                                ? "flex-end"
                                : column.align === "center"
                                  ? "center"
                                  : "flex-start",
                            lineHeight: 1.3,
                            textAlign: column.align,
                            width: "100%",
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
                  rows.map((row) => {
                    const rowId = getRowId(row);
                    const isSelected = rowSelection ? rowSelection.selectedRowIds.includes(rowId) : false;
                    const canSelect = rowSelection ? (rowSelection.isRowSelectable ? rowSelection.isRowSelectable(row) : true) : false;
                    const metaBackground = isSelected
                      ? alpha(brandColors.accent, isDark ? 0.12 : 0.08)
                      : alpha(theme.palette.text.primary, isDark ? 0.06 : 0.04);
                    const detailBackground = isSelected
                      ? alpha(brandColors.accent, isDark ? 0.06 : 0.035)
                      : alpha(theme.palette.background.paper, isDark ? 0.94 : 0.99);
                    const hoverBackground = isSelected
                      ? alpha(brandColors.accent, isDark ? 0.1 : 0.06)
                      : alpha(theme.palette.text.primary, isDark ? 0.04 : 0.025);

                    if (renderMetaRow) {
                      return (
                        <Fragment key={rowId}>
                          <TableRow
                            sx={{
                              "& td": {
                                backgroundColor: metaBackground,
                                borderBottomColor: "transparent",
                              },
                              opacity: rowSelection && !canSelect ? 0.68 : 1,
                            }}
                          >
                            {rowSelection ? (
                              <TableCell
                                padding="none"
                                sx={{
                                  boxShadow: isSelected ? `inset 3px 0 0 ${brandColors.accent}` : "none",
                                  maxWidth: selectionColumnWidth,
                                  minWidth: selectionColumnWidth,
                                  px: 0.5,
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
                                  sx={{ display: "block", mx: "auto", p: 0.5 }}
                                />
                              </TableCell>
                            ) : null}
                            <TableCell colSpan={columns.length} sx={{ px: 1.75, py: 1.1 }}>
                              {renderMetaRow(row)}
                            </TableCell>
                          </TableRow>
                          <TableRow
                            hover
                            sx={{
                              "& td": {
                                backgroundColor: detailBackground,
                                borderBottomColor: alpha(theme.palette.divider, 0.62),
                                fontSize: theme.typography.body2.fontSize,
                                lineHeight: theme.typography.body2.lineHeight,
                                py: 1.6,
                                transition: [
                                  `background-color ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                                  `box-shadow ${brandMotion.duration.standard} ${brandMotion.easing.standard}`,
                                ].join(", "),
                                verticalAlign: "top",
                              },
                              "&:hover td": {
                                backgroundColor: hoverBackground,
                              },
                              opacity: rowSelection && !canSelect ? 0.68 : 1,
                            }}
                          >
                            {rowSelection ? (
                              <TableCell
                                sx={{
                                  backgroundColor: detailBackground,
                                  borderBottomColor: alpha(theme.palette.divider, 0.62),
                                  maxWidth: selectionColumnWidth,
                                  minWidth: selectionColumnWidth,
                                  px: 0,
                                  width: selectionColumnWidth,
                                }}
                              />
                            ) : null}
                            {columns.map((column) => (
                              <TableCell
                                align={column.align}
                                key={column.key}
                                sx={{
                                  minWidth: column.minWidth,
                                  px: 1.25,
                                  textAlign: column.align,
                                  width: column.width,
                                }}
                              >
                                {column.render(row)}
                              </TableCell>
                            ))}
                          </TableRow>
                        </Fragment>
                      );
                    }

                    return (
                      <TableRow
                        hover
                        key={rowId}
                        sx={{
                          "& td": {
                            backgroundColor: detailBackground,
                            borderBottomColor: alpha(theme.palette.divider, 0.62),
                            fontSize: theme.typography.body2.fontSize,
                            lineHeight: theme.typography.body2.lineHeight,
                            py: 1.6,
                            transition: [
                              `background-color ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                              `box-shadow ${brandMotion.duration.standard} ${brandMotion.easing.standard}`,
                            ].join(", "),
                            verticalAlign: "middle",
                          },
                          "&:hover td": {
                            backgroundColor: hoverBackground,
                          },
                          opacity: rowSelection && !canSelect ? 0.68 : 1,
                        }}
                      >
                        {rowSelection ? (
                          <TableCell
                            padding="none"
                            sx={{
                              boxShadow: isSelected ? `inset 3px 0 0 ${brandColors.accent}` : "none",
                              maxWidth: selectionColumnWidth,
                              minWidth: selectionColumnWidth,
                              px: 0.5,
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
                              sx={{ display: "block", mx: "auto", p: 0.5 }}
                            />
                          </TableCell>
                        ) : null}
                        {columns.map((column) => (
                          <TableCell
                            align={column.align}
                            key={column.key}
                            sx={{
                              minWidth: column.minWidth,
                              px: 1.25,
                              textAlign: column.align,
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
              labelDisplayedRows={({ from, to, count }) =>
                t("table.paginationDisplayedRows", {
                  count: count !== -1 ? count : `${to}+`,
                  from,
                  to,
                })
              }
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
