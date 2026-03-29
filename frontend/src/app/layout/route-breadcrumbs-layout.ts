export interface RouteBreadcrumbsLayout<T> {
  hiddenEntries: T[];
  visibleEntries: T[];
}

interface ResolveRouteBreadcrumbsLayoutOptions<T> {
  containerWidth: number;
  entries: T[];
  getEntryWidth: (entry: T) => number;
  getOverflowWidth: (hiddenCount: number) => number;
  separatorWidth: number;
}

function isMeasuredWidth(width: number) {
  return Number.isFinite(width) && width > 0;
}

export function resolveRouteBreadcrumbsLayout<T>({
  containerWidth,
  entries,
  getEntryWidth,
  getOverflowWidth,
  separatorWidth,
}: ResolveRouteBreadcrumbsLayoutOptions<T>): RouteBreadcrumbsLayout<T> {
  if (entries.length === 0) {
    return {
      hiddenEntries: [],
      visibleEntries: [],
    };
  }

  if (!isMeasuredWidth(containerWidth)) {
    return {
      hiddenEntries: [],
      visibleEntries: entries,
    };
  }

  const entryWidths = entries.map((entry) => getEntryWidth(entry));
  if (entryWidths.some((width) => !isMeasuredWidth(width))) {
    return {
      hiddenEntries: [],
      visibleEntries: entries,
    };
  }

  const fullWidth = entryWidths.reduce((sum, width) => sum + width, 0) + separatorWidth * Math.max(entries.length - 1, 0);
  if (fullWidth <= containerWidth) {
    return {
      hiddenEntries: [],
      visibleEntries: entries,
    };
  }

  let visibleCount = 1;
  let consumedWidth = entryWidths[0];

  while (visibleCount < entries.length) {
    const nextWidth = consumedWidth + separatorWidth + entryWidths[visibleCount];
    const hiddenCount = entries.length - (visibleCount + 1);
    const overflowWidth = hiddenCount > 0 ? getOverflowWidth(hiddenCount) : 0;

    if (hiddenCount > 0 && !isMeasuredWidth(overflowWidth)) {
      return {
        hiddenEntries: [],
        visibleEntries: entries,
      };
    }

    const layoutWidth = hiddenCount > 0 ? nextWidth + separatorWidth + overflowWidth : nextWidth;
    if (layoutWidth > containerWidth) {
      break;
    }

    consumedWidth = nextWidth;
    visibleCount += 1;
  }

  return {
    hiddenEntries: entries.slice(visibleCount),
    visibleEntries: entries.slice(0, visibleCount),
  };
}
