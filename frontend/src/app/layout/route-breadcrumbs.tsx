import { useEffect, useMemo, useState } from "react";

import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import { Box, ButtonBase, IconButton, Link, ListItemText, Menu, MenuItem, Stack } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { Link as RouterLink, useLocation, useMatches } from "react-router-dom";

import { resolveRouteBreadcrumbsLayout } from "@/app/layout/route-breadcrumbs-layout";
import { useBreadcrumbMeasurements } from "@/app/layout/use-breadcrumb-measurements";
import { brandColors, brandMotion, brandShadows } from "@/app/brand";
import { useI18n } from "@/app/ui-preferences";
import {
  loadSessionRouteBreadcrumbs,
  persistSessionRouteBreadcrumbs,
  recordSessionRouteBreadcrumb,
  removeSessionRouteBreadcrumb,
  type SessionRouteBreadcrumbEntry,
} from "@/shared/storage/route-breadcrumb-storage";

const breadcrumbSeparatorWidth = 18;

interface RouteHandle {
  crumb?: string;
}

interface RenderableBreadcrumbEntry extends SessionRouteBreadcrumbEntry {
  isCurrent: boolean;
  label: string;
}

function buildRouteLabelKey(matches: ReturnType<typeof useMatches>) {
  const lastLabeledMatch = [...matches].reverse().find((match) => typeof match.handle === "object" && match.handle && "crumb" in match.handle);
  const crumb = lastLabeledMatch?.handle && typeof lastLabeledMatch.handle === "object" ? (lastLabeledMatch.handle as RouteHandle).crumb : null;
  if (typeof crumb === "string" && crumb.trim()) {
    return crumb;
  }

  return null;
}

function areSessionRouteBreadcrumbsEqual(left: SessionRouteBreadcrumbEntry[], right: SessionRouteBreadcrumbEntry[]) {
  return left.length === right.length && left.every((entry, index) => entry.href === right[index]?.href && entry.labelKey === right[index]?.labelKey);
}

function buildRenderableEntryMeasurementId(entry: RenderableBreadcrumbEntry) {
  return `${entry.href}:${entry.label}:${entry.isCurrent ? "1" : "0"}`;
}

function buildMeasurementKey(entries: RenderableBreadcrumbEntry[]) {
  return entries.map((entry) => buildRenderableEntryMeasurementId(entry)).join("\u001f");
}

function useSessionRouteBreadcrumbHistory(currentEntry: SessionRouteBreadcrumbEntry | null) {
  const [historyEntries, setHistoryEntries] = useState<SessionRouteBreadcrumbEntry[]>(() => {
    const storedEntries = loadSessionRouteBreadcrumbs();
    return currentEntry ? recordSessionRouteBreadcrumb(storedEntries, currentEntry) : storedEntries;
  });

  useEffect(() => {
    if (!currentEntry) {
      return;
    }

    const nextEntries = recordSessionRouteBreadcrumb(loadSessionRouteBreadcrumbs(), currentEntry);
    persistSessionRouteBreadcrumbs(nextEntries);
    setHistoryEntries((previousEntries) => (areSessionRouteBreadcrumbsEqual(previousEntries, nextEntries) ? previousEntries : nextEntries));
  }, [currentEntry]);

  function removeEntry(href: string) {
    setHistoryEntries((previousEntries) => {
      const nextEntries = removeSessionRouteBreadcrumb(previousEntries, href);
      persistSessionRouteBreadcrumbs(nextEntries);
      return nextEntries;
    });
  }

  return {
    historyEntries,
    removeEntry,
  };
}

export function RouteBreadcrumbs() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t, translate } = useI18n();
  const location = useLocation();
  const matches = useMatches();
  const currentLabelKey = buildRouteLabelKey(matches);
  const currentEntry = useMemo<SessionRouteBreadcrumbEntry | null>(
    () =>
      currentLabelKey
        ? {
            href: `${location.pathname}${location.search}${location.hash}`,
            labelKey: currentLabelKey,
          }
        : null,
    [currentLabelKey, location.hash, location.pathname, location.search],
  );
  const { historyEntries, removeEntry } = useSessionRouteBreadcrumbHistory(currentEntry);
  const renderedEntries = useMemo<RenderableBreadcrumbEntry[]>(
    () =>
      historyEntries.map((entry) => ({
        ...entry,
        isCurrent: currentEntry != null && entry.href === currentEntry.href,
        label: translate(entry.labelKey),
      })),
    [currentEntry?.href, historyEntries, translate],
  );
  const measurementKey = useMemo(() => buildMeasurementKey(renderedEntries), [renderedEntries]);
  const overflowCounts = useMemo(
    () => Array.from({ length: Math.max(renderedEntries.length - 1, 0) }, (_, index) => index + 1),
    [renderedEntries.length],
  );
  const { containerRef, measurements, setEntryMeasureNode, setOverflowMeasureNode } = useBreadcrumbMeasurements([measurementKey]);
  const { hiddenEntries, visibleEntries } = useMemo(
    () =>
      resolveRouteBreadcrumbsLayout({
        containerWidth: measurements.containerWidth,
        entries: renderedEntries,
        getEntryWidth: (entry) => measurements.entryWidths[buildRenderableEntryMeasurementId(entry)] ?? 0,
        getOverflowWidth: (hiddenCount) => measurements.overflowWidths[hiddenCount] ?? 0,
        separatorWidth: breadcrumbSeparatorWidth,
      }),
    [measurements.containerWidth, measurements.entryWidths, measurements.overflowWidths, renderedEntries],
  );
  const [overflowAnchorEl, setOverflowAnchorEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (hiddenEntries.length === 0) {
      setOverflowAnchorEl(null);
    }
  }, [hiddenEntries.length]);

  if (historyEntries.length === 0) {
    return null;
  }

  function renderBreadcrumbEntry(
    entry: RenderableBreadcrumbEntry,
    options: {
      measureNode?: (node: HTMLDivElement | null) => void;
      measureOnly?: boolean;
      onNavigate?: () => void;
    } = {},
  ) {
    const measureOnly = options.measureOnly === true;

    return (
      <Stack
        alignItems="center"
        className="breadcrumb-chip"
        direction="row"
        key={entry.href}
        ref={options.measureNode}
        spacing={0.25}
        sx={{
          "& .breadcrumb-remove": entry.isCurrent
            ? undefined
            : {
                opacity: 0,
                transform: "scale(0.9)",
                transition: [
                  `opacity ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                  `transform ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                ].join(", "),
              },
          "&:focus-within": entry.isCurrent
            ? undefined
            : {
                boxShadow: `${brandShadows.accentGlow}, 0 0 0 3px ${alpha(brandColors.accent, isDark ? 0.14 : 0.1)}`,
              },
          "&:focus-within .breadcrumb-remove": entry.isCurrent
            ? undefined
            : {
                opacity: 1,
                transform: "scale(1)",
              },
          "&:hover": entry.isCurrent
            ? undefined
            : {
                boxShadow: brandShadows.accentGlow,
                transform: "translateY(-1px)",
              },
          "&:hover .breadcrumb-remove": entry.isCurrent
            ? undefined
            : {
                opacity: 1,
                transform: "scale(1)",
              },
          backgroundColor: entry.isCurrent
            ? alpha(brandColors.accent, isDark ? 0.18 : 0.12)
            : alpha(theme.palette.background.paper, isDark ? 0.36 : 0.62),
          border: `1px solid ${
            entry.isCurrent
              ? alpha(brandColors.accentStrong, isDark ? 0.34 : 0.22)
              : alpha(theme.palette.divider, 0.84)
          }`,
          borderRadius: 999,
          boxShadow: entry.isCurrent ? `inset 0 0 0 1px ${alpha(brandColors.accent, 0.18)}, ${brandShadows.accentGlow}` : "none",
          color: entry.isCurrent ? theme.palette.text.primary : alpha(theme.palette.text.primary, isDark ? 0.82 : 0.74),
          display: measureOnly ? "inline-flex" : undefined,
          flex: "0 0 auto",
          maxWidth: measureOnly ? "none" : { xs: 180, md: 240 },
          minWidth: 0,
          pl: 0.5,
          pr: entry.isCurrent ? 0.5 : 0.25,
          py: 0.125,
          transition: [
            `background-color ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
            `border-color ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
            `box-shadow ${brandMotion.duration.standard} ${brandMotion.easing.standard}`,
            `transform ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
          ].join(", "),
          width: measureOnly ? "max-content" : undefined,
        }}
      >
        <Link
          {...(measureOnly ? { component: "span" as const } : { component: RouterLink, onClick: options.onNavigate, to: entry.href })}
          aria-current={measureOnly ? undefined : entry.isCurrent ? "page" : undefined}
          color="inherit"
          underline="none"
          variant="body2"
          sx={{
            display: "block",
            fontWeight: entry.isCurrent ? 700 : 500,
            maxWidth: measureOnly ? "none" : undefined,
            overflow: measureOnly ? "visible" : "hidden",
            px: 0.5,
            py: 0.25,
            textDecoration: "none",
            textOverflow: measureOnly ? "clip" : "ellipsis",
            whiteSpace: "nowrap",
            width: measureOnly ? "max-content" : undefined,
            "&:hover": {
              textDecoration: "none",
            },
          }}
        >
          {entry.label}
        </Link>
        {!entry.isCurrent ? (
          <IconButton
            aria-label={t("Remove from quick access: {{label}}", { label: entry.label })}
            className="breadcrumb-remove"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              removeEntry(entry.href);
            }}
            size="small"
            sx={{
              color: alpha(theme.palette.text.primary, isDark ? 0.66 : 0.54),
              p: 0.25,
              "&:hover": {
                backgroundColor: alpha(theme.palette.text.primary, isDark ? 0.08 : 0.06),
                color: theme.palette.text.primary,
              },
            }}
          >
            <CloseRoundedIcon sx={{ fontSize: 13 }} />
          </IconButton>
        ) : null}
      </Stack>
    );
  }

  function renderOverflowTrigger(
    hiddenCount: number,
    options: {
      measureNode?: (node: HTMLButtonElement | null) => void;
      measureOnly?: boolean;
    } = {},
  ) {
    const measureOnly = options.measureOnly === true;
    const overflowLabel = `...+${hiddenCount}`;

    return (
      <ButtonBase
        aria-controls={!measureOnly && overflowAnchorEl ? "route-breadcrumbs-overflow-menu" : undefined}
        aria-expanded={!measureOnly && overflowAnchorEl ? "true" : undefined}
        aria-haspopup={measureOnly ? undefined : "menu"}
        aria-label={measureOnly ? undefined : t("Show hidden visited pages")}
        key={`hidden-${hiddenCount}`}
        onClick={
          measureOnly
            ? undefined
            : (event) => {
                setOverflowAnchorEl(event.currentTarget);
              }
        }
        ref={options.measureNode}
        sx={{
          alignItems: "center",
          backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.34 : 0.62),
          border: `1px dashed ${alpha(theme.palette.divider, 0.9)}`,
          borderRadius: 999,
          color: alpha(theme.palette.text.primary, isDark ? 0.8 : 0.72),
          display: "inline-flex",
          flex: "0 0 auto",
          fontSize: theme.typography.body2.fontSize,
          fontVariantNumeric: "tabular-nums",
          fontWeight: 700,
          minHeight: 28,
          px: 1,
          py: 0.5,
          transition: [
            `background-color ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
            `border-color ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
            `box-shadow ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
          ].join(", "),
          whiteSpace: "nowrap",
          width: measureOnly ? "max-content" : undefined,
          "&:focus-visible": {
            boxShadow: `${brandShadows.accentGlow}, 0 0 0 3px ${alpha(brandColors.accent, isDark ? 0.14 : 0.1)}`,
          },
          "&:hover": {
            backgroundColor: alpha(brandColors.accent, isDark ? 0.16 : 0.1),
            borderColor: alpha(brandColors.accentStrong, isDark ? 0.4 : 0.22),
          },
        }}
      >
        {overflowLabel}
      </ButtonBase>
    );
  }

  function renderSeparator(key: string) {
    return (
      <Box
        aria-hidden="true"
        component="span"
        key={key}
        sx={{
          alignItems: "center",
          display: "inline-flex",
          flex: "0 0 auto",
          justifyContent: "center",
          width: `${breadcrumbSeparatorWidth}px`,
        }}
      >
        <NavigateNextIcon fontSize="small" />
      </Box>
    );
  }

  const overflowMenuOpen = hiddenEntries.length > 0 && Boolean(overflowAnchorEl);
  const railItems = visibleEntries.flatMap((entry, index) =>
    index === 0 ? [renderBreadcrumbEntry(entry)] : [renderSeparator(`visible-separator-${entry.href}`), renderBreadcrumbEntry(entry)],
  );
  if (hiddenEntries.length > 0) {
    if (visibleEntries.length > 0) {
      railItems.push(renderSeparator(`overflow-separator-${hiddenEntries.length}`));
    }
    railItems.push(renderOverflowTrigger(hiddenEntries.length));
  }

  return (
    <Stack alignItems="center" direction="row" spacing={1} sx={{ maxWidth: "100%", minWidth: 0, width: "100%" }}>
      <Box
        aria-label={t("breadcrumb")}
        component="nav"
        ref={containerRef}
        sx={{
          flex: 1,
          maxWidth: "100%",
          minWidth: 0,
          overflow: "hidden",
          px: "2px",
          py: "4px",
          position: "relative",
          width: "100%",
        }}
      >
        <Box
          component="div"
          data-testid="route-breadcrumbs-rail"
          sx={{
            alignItems: "center",
            display: "flex",
            maxWidth: "100%",
            minWidth: 0,
            overflow: "hidden",
            whiteSpace: "nowrap",
            width: "100%",
          }}
        >
          {railItems}
        </Box>
        <Box
          aria-hidden="true"
          data-testid="route-breadcrumbs-measurements"
          sx={{
            left: 0,
            pointerEvents: "none",
            position: "absolute",
            top: 0,
            visibility: "hidden",
            whiteSpace: "nowrap",
          }}
        >
          {renderedEntries.map((entry) =>
            renderBreadcrumbEntry(entry, {
              measureNode: (node) => setEntryMeasureNode(buildRenderableEntryMeasurementId(entry), node),
              measureOnly: true,
            }),
          )}
          {overflowCounts.map((hiddenCount) =>
            renderOverflowTrigger(hiddenCount, {
              measureNode: (node) => setOverflowMeasureNode(hiddenCount, node),
              measureOnly: true,
            }),
          )}
        </Box>
      </Box>
      <Menu
        anchorEl={overflowAnchorEl}
        id="route-breadcrumbs-overflow-menu"
        MenuListProps={{ "aria-label": t("Recent pages"), dense: true }}
        onClose={() => {
          setOverflowAnchorEl(null);
        }}
        open={overflowMenuOpen}
        slotProps={{
          paper: {
            sx: {
              maxWidth: 360,
              minWidth: 280,
              mt: 1,
            },
          },
        }}
      >
        {hiddenEntries.map((entry) => (
          <Box key={entry.href} sx={{ alignItems: "center", display: "flex", gap: 0.5, minWidth: 0, pr: 0.5 }}>
            <MenuItem
              component={RouterLink}
              onClick={() => {
                setOverflowAnchorEl(null);
              }}
              selected={entry.isCurrent}
              sx={{ borderRadius: 1.5, flex: 1, minWidth: 0, my: 0.25, mx: 0.5 }}
              to={entry.href}
            >
              <ListItemText
                primary={entry.label}
                primaryTypographyProps={{
                  fontWeight: entry.isCurrent ? 700 : 500,
                  noWrap: true,
                }}
              />
            </MenuItem>
            {!entry.isCurrent ? (
              <IconButton
                aria-label={t("Remove from recent pages: {{label}}", { label: entry.label })}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  removeEntry(entry.href);
                }}
                size="small"
                sx={{
                  color: alpha(theme.palette.text.primary, isDark ? 0.66 : 0.54),
                  p: 0.375,
                  "&:hover": {
                    backgroundColor: alpha(theme.palette.text.primary, isDark ? 0.08 : 0.06),
                    color: theme.palette.text.primary,
                  },
                }}
              >
                <CloseRoundedIcon sx={{ fontSize: 14 }} />
              </IconButton>
            ) : null}
          </Box>
        ))}
      </Menu>
    </Stack>
  );
}
