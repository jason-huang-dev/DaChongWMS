import { Fragment, type ReactNode, useCallback, useEffect, useRef } from "react";

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
  sticky?: "left" | "right";
  width?: number | string;
  render: (row: TRow) => ReactNode;
}

interface DataTableStickyColumnConfig {
  offset: number;
  side: "left" | "right";
}

function parseStickyColumnWidth(value?: number | string) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return 0;
  }

  const normalizedValue = value.trim();
  if (/^\d+(\.\d+)?$/u.test(normalizedValue)) {
    return Number(normalizedValue);
  }
  if (/^\d+(\.\d+)?px$/u.test(normalizedValue)) {
    return Number(normalizedValue.slice(0, -2));
  }
  return 0;
}

function buildStickyColumnConfig<TRow, TSortKey extends string>(
  columns: Array<DataTableColumnDefinition<TRow, TSortKey>>,
) {
  const stickyConfig = new Map<string, DataTableStickyColumnConfig>();
  let leftOffset = 0;

  columns.forEach((column) => {
    if (column.sticky !== "left") {
      return;
    }

    stickyConfig.set(column.key, { offset: leftOffset, side: "left" });
    leftOffset += parseStickyColumnWidth(column.width) || parseStickyColumnWidth(column.minWidth);
  });

  let rightOffset = 0;
  [...columns].reverse().forEach((column) => {
    if (column.sticky !== "right") {
      return;
    }

    stickyConfig.set(column.key, { offset: rightOffset, side: "right" });
    rightOffset += parseStickyColumnWidth(column.width) || parseStickyColumnWidth(column.minWidth);
  });

  return stickyConfig;
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

export interface DataTableScrollState {
  isScrolled: boolean;
  isScrolling: boolean;
  scrollTop: number;
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
  fillHeight?: boolean;
  stickyHeader?: boolean;
  onScrollStateChange?: (state: DataTableScrollState) => void;
  toolbarPlacement?: "inner" | "outer";
  renderDetailContent?: (row: TRow) => ReactNode;
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
  fillHeight = false,
  stickyHeader = false,
  onScrollStateChange,
  toolbarPlacement = "outer",
  renderDetailContent,
  sorting,
}: DataTableProps<TRow, TSortKey>) {
  const theme = useTheme();
  const { t, translate, msg } = useI18n();
  const isDark = theme.palette.mode === "dark";
  const selectableRows = rowSelection
    ? rows.filter((row) => (rowSelection.isRowSelectable ? rowSelection.isRowSelectable(row) : true))
    : [];
  const selectableIds = selectableRows.map((row) => getRowId(row));
  const selectedSelectableCount = selectableIds.filter((id) => rowSelection?.selectedRowIds.includes(id)).length;
  const allSelected = selectableIds.length > 0 && selectedSelectableCount === selectableIds.length;
  const partiallySelected = selectedSelectableCount > 0 && !allSelected;
  const chromeShellRef = useRef<HTMLDivElement | null>(null);
  const tableContainerRef = useRef<HTMLDivElement | null>(null);
  const tableElementRef = useRef<HTMLTableElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const pendingScrollChromeRef = useRef<{ isScrolling?: boolean; scrollNode: HTMLElement | null } | null>(null);
  const scrollStateRef = useRef<DataTableScrollState>({ isScrolled: false, isScrolling: false, scrollTop: 0 });
  const scrollTimeoutRef = useRef<number | null>(null);
  const applyScrollChrome = useCallback((scrollNode: HTMLElement | null, options?: { isScrolling?: boolean }) => {
    const chromeNode = chromeShellRef.current;
    if (!chromeNode || !scrollNode) {
      return;
    }

    const maxScrollTop = Math.max(scrollNode.scrollHeight - scrollNode.clientHeight, 0);
    const scrollTop = Math.min(Math.max(scrollNode.scrollTop, 0), maxScrollTop);
    const topProgress = maxScrollTop > 0 ? Math.min(scrollTop / 36, 1) : 0;
    const bottomProgress = maxScrollTop > 0 ? Math.min((maxScrollTop - scrollTop) / 48, 1) : 0;
    const frameProgress = maxScrollTop > 0 ? Math.max(topProgress * 0.6, bottomProgress * 0.45) : 0;
    const scrollingBoost = options?.isScrolling ? 0.12 : 0;

    chromeNode.style.setProperty("--DataTable-top-shadow-opacity", `${Math.min(topProgress + scrollingBoost, 1)}`);
    chromeNode.style.setProperty("--DataTable-bottom-shadow-opacity", `${Math.min(bottomProgress + scrollingBoost * 0.7, 1)}`);
    chromeNode.style.setProperty("--DataTable-frame-glow-opacity", `${Math.min(frameProgress + scrollingBoost * 0.45, 1)}`);
  }, []);
  const scheduleScrollChrome = useCallback((scrollNode: HTMLElement | null, options?: { isScrolling?: boolean }) => {
    pendingScrollChromeRef.current = { isScrolling: options?.isScrolling, scrollNode };
    if (animationFrameRef.current !== null || typeof window === "undefined") {
      return;
    }

    animationFrameRef.current = window.requestAnimationFrame(() => {
      animationFrameRef.current = null;
      const pending = pendingScrollChromeRef.current;
      if (!pending) {
        return;
      }
      applyScrollChrome(pending.scrollNode, { isScrolling: pending.isScrolling });
    });
  }, [applyScrollChrome]);
  const emitScrollState = useCallback(
    (nextState: DataTableScrollState) => {
      if (
        scrollStateRef.current.isScrolled === nextState.isScrolled &&
        scrollStateRef.current.isScrolling === nextState.isScrolling &&
        scrollStateRef.current.scrollTop === nextState.scrollTop
      ) {
        return;
      }
      scrollStateRef.current = nextState;
      onScrollStateChange?.(nextState);
    },
    [onScrollStateChange],
  );

  const tableChromeTransition = [
    `background-color ${brandMotion.duration.standard} ${brandMotion.easing.standard}`,
    `border-color ${brandMotion.duration.standard} ${brandMotion.easing.standard}`,
    `box-shadow ${brandMotion.duration.slow} ${brandMotion.easing.emphasized}`,
    `opacity ${brandMotion.duration.standard} ${brandMotion.easing.standard}`,
  ].join(", ");
  const stickyColumnConfig = buildStickyColumnConfig(columns);
  const stickySurfaceBackground = alpha(theme.palette.background.paper, isDark ? 0.98 : 0.995);
  const stickyDividerColor = alpha(theme.palette.divider, 0.82);
  const stickyColumnDivider = `1px solid ${alpha(theme.palette.divider, isDark ? 0.56 : 0.9)}`;
  const topShadowGradient = `linear-gradient(180deg, ${alpha(theme.palette.common.black, isDark ? 0.18 : 0.08)} 0%, transparent 100%)`;
  const bottomShadowGradient = `linear-gradient(180deg, transparent 0%, ${alpha(theme.palette.common.black, isDark ? 0.16 : 0.07)} 100%)`;
  const frameGlowShadow = isDark
    ? `0 0 0 1px ${alpha(theme.palette.divider, 0.2)}, 0 18px 36px ${alpha(theme.palette.common.black, 0.22)}`
    : `0 0 0 1px ${alpha(theme.palette.common.white, 0.72)}, 0 16px 32px ${alpha(theme.palette.common.black, 0.08)}`;
  const getStickyColumnSx = (column: DataTableColumnDefinition<TRow, TSortKey>, isHeader = false) => {
    const config = stickyColumnConfig.get(column.key);
    if (!config) {
      return undefined;
    }

    return {
      [config.side]: config.offset,
      borderLeft: config.side === "right" ? stickyColumnDivider : undefined,
      borderRight: config.side === "left" ? stickyColumnDivider : undefined,
      position: "sticky" as const,
      zIndex: isHeader ? 4 : 1,
    };
  };

  useEffect(() => {
    emitScrollState({ isScrolled: false, isScrolling: false, scrollTop: 0 });
  }, [emitScrollState]);

  useEffect(() => {
    scheduleScrollChrome(tableContainerRef.current, { isScrolling: scrollStateRef.current.isScrolling });
  }, [isLoading, pagination?.page, pagination?.pageSize, pagination?.total, rows, scheduleScrollChrome]);

  useEffect(() => {
    const scrollNode = tableContainerRef.current;
    const tableNode = tableElementRef.current;
    if (!scrollNode || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      scheduleScrollChrome(scrollNode, { isScrolling: scrollStateRef.current.isScrolling });
    });

    observer.observe(scrollNode);
    if (tableNode) {
      observer.observe(tableNode);
    }

    return () => {
      observer.disconnect();
    };
  }, [scheduleScrollChrome]);

  useEffect(
    () => () => {
      if (scrollTimeoutRef.current !== null && typeof window !== "undefined") {
        window.clearTimeout(scrollTimeoutRef.current);
      }
      if (animationFrameRef.current !== null && typeof window !== "undefined") {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    },
    [],
  );

  return (
    <Card
      sx={
        fillHeight
          ? {
              display: "flex",
              flexDirection: "column",
              height: "100%",
              minHeight: 0,
            }
          : undefined
      }
    >
      <CardContent
        sx={{
          display: "flex",
          flex: fillHeight ? "1 1 auto" : undefined,
          flexDirection: "column",
          minHeight: 0,
          pb: 1.5,
        }}
      >
        <Stack
          ref={chromeShellRef}
          spacing={2}
          sx={{
            "--DataTable-bottom-shadow-opacity": pagination ? 1 : 0,
            "--DataTable-frame-glow-opacity": 0,
            "--DataTable-top-shadow-opacity": 0,
            flex: fillHeight ? "1 1 auto" : undefined,
            isolation: "isolate",
            minHeight: fillHeight ? 0 : undefined,
            overflow: fillHeight ? "hidden" : undefined,
            position: "relative",
          }}
        >
          {toolbar && toolbarPlacement === "outer" ? toolbar : null}
          {error ? <Alert severity="error">{error}</Alert> : null}

          <Stack
            sx={{
              border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
              borderRadius: 1.5,
              flex: fillHeight ? "1 1 auto" : undefined,
              minHeight: fillHeight ? 0 : undefined,
              overflow: "hidden",
              position: "relative",
              transition: tableChromeTransition,
              "&::before": {
                borderRadius: "inherit",
                boxShadow: frameGlowShadow,
                content: "\"\"",
                inset: 0,
                opacity: "var(--DataTable-frame-glow-opacity)",
                pointerEvents: "none",
                position: "absolute",
                transition: `opacity ${brandMotion.duration.slow} ${brandMotion.easing.emphasized}`,
                zIndex: 0,
              },
            }}
          >
            {toolbar && toolbarPlacement === "inner" ? (
              <Box
                sx={{
                  backgroundColor: stickySurfaceBackground,
                  borderBottom: `1px solid ${stickyDividerColor}`,
                  flex: "0 0 auto",
                  px: 1.5,
                  py: 1.25,
                  position: "relative",
                  transition: tableChromeTransition,
                  zIndex: 2,
                  "&::after": {
                    background: topShadowGradient,
                    content: "\"\"",
                    height: 14,
                    left: 0,
                    opacity: "var(--DataTable-top-shadow-opacity)",
                    pointerEvents: "none",
                    position: "absolute",
                    right: 0,
                    top: "100%",
                    transition: `opacity ${brandMotion.duration.slow} ${brandMotion.easing.emphasized}`,
                  },
                }}
              >
                {toolbar}
              </Box>
            ) : null}
            <TableContainer
              ref={tableContainerRef}
              onScroll={(event) => {
                const scrollNode = event.currentTarget;
                const scrollTop = scrollNode.scrollTop;
                const isScrolled = scrollTop > 4;
                scheduleScrollChrome(scrollNode, { isScrolling: true });
                emitScrollState({ isScrolled, isScrolling: true, scrollTop });
                if (scrollTimeoutRef.current !== null && typeof window !== "undefined") {
                  window.clearTimeout(scrollTimeoutRef.current);
                }
                if (typeof window !== "undefined") {
                  scrollTimeoutRef.current = window.setTimeout(() => {
                    scheduleScrollChrome(scrollNode, { isScrolling: false });
                    emitScrollState({
                      isScrolled: scrollNode.scrollTop > 4,
                      isScrolling: false,
                      scrollTop: scrollNode.scrollTop,
                    });
                  }, 140);
                }
              }}
              sx={{
                flex: fillHeight ? "1 1 auto" : undefined,
                minHeight: fillHeight ? 0 : undefined,
                overscrollBehavior: "contain",
                overflowX: "auto",
                overflowY: fillHeight ? "auto" : "hidden",
                scrollbarGutter: fillHeight ? "stable" : undefined,
              }}
            >
              <Table
                ref={tableElementRef}
                size="small"
                stickyHeader={stickyHeader || fillHeight}
                sx={{ tableLayout: "fixed", width: "100%" }}
              >
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
                          backgroundColor: stickySurfaceBackground,
                          borderBottomColor: stickyDividerColor,
                          boxSizing: "border-box",
                          maxWidth: selectionColumnWidth,
                          minWidth: selectionColumnWidth,
                          px: 0.5,
                          textAlign: "center",
                          transition: tableChromeTransition,
                          verticalAlign: "middle",
                          width: selectionColumnWidth,
                          zIndex: stickyHeader || fillHeight ? 2 : undefined,
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
                        data-sticky-column={column.sticky}
                        key={column.key}
                        sx={{
                          ...getStickyColumnSx(column, true),
                          backgroundColor: stickySurfaceBackground,
                          borderBottomColor: stickyDividerColor,
                          color: theme.palette.text.primary,
                          fontSize: theme.typography.body2.fontSize,
                          fontWeight: 800,
                          lineHeight: 1.3,
                          minWidth: column.minWidth,
                          px: 1.25,
                          py: 1.2,
                          textAlign: column.align,
                          transition: tableChromeTransition,
                          whiteSpace: "normal",
                          width: column.width,
                          zIndex: stickyHeader || fillHeight ? 2 : undefined,
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
                            {t(column.header)}
                          </TableSortLabel>
                        ) : (
                          t(column.header)
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
                          <Typography variant="body2">{t("Loading data...")}</Typography>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={columns.length + (rowSelection ? 1 : 0)}>
                        <Typography color="text.secondary" sx={{ py: 3 }} textAlign="center" variant="body2">
                          {t(emptyMessage)}
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
                                boxShadow: "inset 0 0 0 1px transparent",
                                fontSize: theme.typography.body2.fontSize,
                                lineHeight: theme.typography.body2.lineHeight,
                                py: 1.6,
                                transition: [
                                  `background-color ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                                  `border-color ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                                  `box-shadow ${brandMotion.duration.standard} ${brandMotion.easing.standard}`,
                                ].join(", "),
                                verticalAlign: "top",
                              },
                              "&:hover td": {
                                backgroundColor: hoverBackground,
                                boxShadow: `inset 0 0 0 1px ${alpha(brandColors.accent, isDark ? 0.12 : 0.08)}`,
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
                            {renderDetailContent ? (
                              <TableCell colSpan={columns.length} sx={{ minWidth: 0, px: 0, py: 0 }}>
                                {renderDetailContent(row)}
                              </TableCell>
                            ) : (
                              columns.map((column) => (
                                <TableCell
                                  align={column.align}
                                  data-sticky-column={column.sticky}
                                  key={column.key}
                                  sx={{
                                    ...getStickyColumnSx(column),
                                    minWidth: column.minWidth,
                                    px: 1.25,
                                    textAlign: column.align,
                                    width: column.width,
                                  }}
                                >
                                  {column.render(row)}
                                </TableCell>
                              ))
                            )}
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
                            boxShadow: "inset 0 0 0 1px transparent",
                            fontSize: theme.typography.body2.fontSize,
                            lineHeight: theme.typography.body2.lineHeight,
                            py: 1.6,
                            transition: [
                              `background-color ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                              `border-color ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                              `box-shadow ${brandMotion.duration.standard} ${brandMotion.easing.standard}`,
                            ].join(", "),
                            verticalAlign: "middle",
                          },
                          "&:hover td": {
                            backgroundColor: hoverBackground,
                            boxShadow: `inset 0 0 0 1px ${alpha(brandColors.accent, isDark ? 0.12 : 0.08)}`,
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
                            data-sticky-column={column.sticky}
                            key={column.key}
                            sx={{
                              ...getStickyColumnSx(column),
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
                sx={{
                  backgroundColor: stickySurfaceBackground,
                  borderTop: `1px solid ${stickyDividerColor}`,
                  borderBottomLeftRadius: 10,
                  borderBottomRightRadius: 10,
                  flex: "0 0 auto",
                  mt: 0,
                  position: "relative",
                  transition: tableChromeTransition,
                  "&::before": {
                    background: bottomShadowGradient,
                    bottom: "100%",
                    content: "\"\"",
                    height: 14,
                    left: 0,
                    opacity: "var(--DataTable-bottom-shadow-opacity)",
                    pointerEvents: "none",
                    position: "absolute",
                    right: 0,
                    transition: `opacity ${brandMotion.duration.slow} ${brandMotion.easing.emphasized}`,
                  },
                }}
              />
            ) : null}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
