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
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import { brandColors, brandMotion } from "@/app/brand";
import { useI18n } from "@/app/ui-preferences";

interface ColumnDefinition<TRow> {
  key: string;
  header: string;
  align?: "left" | "right" | "center";
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
  title: string;
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
}: ResourceTableProps<TRow>) {
  const theme = useTheme();
  const { translateText } = useI18n();
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
      <CardContent>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h6">{translateText(title)}</Typography>
            {subtitle ? (
              <Typography color="text.secondary" variant="body2">
                {translateText(subtitle)}
              </Typography>
            ) : null}
          </Box>
          {toolbar}
          {error ? <Alert severity="error">{error}</Alert> : null}
          <TableContainer
            sx={{
              border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
              borderRadius: 3,
              overflow: "hidden",
            }}
          >
            <Table size="small">
              <TableHead>
                <TableRow
                  sx={{
                    backgroundColor: alpha(theme.palette.text.primary, isDark ? 0.05 : 0.03),
                  }}
                >
                  {rowSelection ? (
                    <TableCell
                      padding="checkbox"
                      sx={{
                        borderBottomColor: alpha(theme.palette.divider, 0.8),
                      }}
                    >
                      <Checkbox
                        checked={allSelected}
                        disabled={selectableRows.length === 0}
                        indeterminate={partiallySelected}
                        onChange={() => rowSelection.onToggleAll(selectableRows)}
                      />
                    </TableCell>
                  ) : null}
                  {columns.map((column) => (
                    <TableCell
                      align={column.align}
                      key={column.key}
                      sx={{
                        borderBottomColor: alpha(theme.palette.divider, 0.8),
                        color: theme.palette.text.secondary,
                        fontSize: 12,
                        fontWeight: 800,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                      }}
                    >
                      {translateText(column.header)}
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
                          <TableCell padding="checkbox">
                            <Checkbox
                              checked={isSelected}
                              disabled={!canSelect}
                              onChange={() => rowSelection.onToggleRow(row)}
                            />
                          </TableCell>
                        ) : null}
                        {columns.map((column) => (
                          <TableCell
                            align={column.align}
                            key={column.key}
                            sx={{
                              fontSize: 13,
                              verticalAlign: "top",
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
