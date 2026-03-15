import type { ReactNode } from "react";

import {
  Alert,
  Box,
  Card,
  CardContent,
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
}: ResourceTableProps<TRow>) {
  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h6">{title}</Typography>
            {subtitle ? (
              <Typography color="text.secondary" variant="body2">
                {subtitle}
              </Typography>
            ) : null}
          </Box>
          {error ? <Alert severity="error">{error}</Alert> : null}
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {columns.map((column) => (
                    <TableCell align={column.align} key={column.key}>
                      {column.header}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={columns.length}>
                      <Stack alignItems="center" direction="row" justifyContent="center" spacing={1.5} sx={{ py: 4 }}>
                        <CircularProgress size={20} />
                        <Typography variant="body2">Loading data...</Typography>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length}>
                      <Typography color="text.secondary" sx={{ py: 3 }} textAlign="center" variant="body2">
                        {emptyMessage}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow hover key={getRowId(row)}>
                      {columns.map((column) => (
                        <TableCell align={column.align} key={column.key}>
                          {column.render(row)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
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
