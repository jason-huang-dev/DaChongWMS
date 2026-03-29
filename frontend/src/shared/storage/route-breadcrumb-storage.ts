export interface SessionRouteBreadcrumbEntry {
  href: string;
  labelKey: string;
}

const storageKey = "dachongwms.route-breadcrumbs";
export const maxSessionRouteBreadcrumbEntries = 100;

function canUseSessionStorage() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function isSessionRouteBreadcrumbEntry(value: unknown): value is SessionRouteBreadcrumbEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<SessionRouteBreadcrumbEntry>;
  return typeof candidate.href === "string" && candidate.href.length > 0 && typeof candidate.labelKey === "string" && candidate.labelKey.length > 0;
}

export function loadSessionRouteBreadcrumbs() {
  if (!canUseSessionStorage()) {
    return [] as SessionRouteBreadcrumbEntry[];
  }

  const rawValue = window.sessionStorage.getItem(storageKey);
  if (!rawValue) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(rawValue) as unknown;
    return Array.isArray(parsedValue) ? normalizeSessionRouteBreadcrumbs(parsedValue.filter(isSessionRouteBreadcrumbEntry)) : [];
  } catch {
    window.sessionStorage.removeItem(storageKey);
    return [];
  }
}

export function persistSessionRouteBreadcrumbs(entries: SessionRouteBreadcrumbEntry[]) {
  if (!canUseSessionStorage()) {
    return;
  }

  window.sessionStorage.setItem(storageKey, JSON.stringify(normalizeSessionRouteBreadcrumbs(entries)));
}

function normalizeSessionRouteBreadcrumbs(entries: SessionRouteBreadcrumbEntry[]) {
  const seenHrefs = new Set<string>();
  const normalizedEntries: SessionRouteBreadcrumbEntry[] = [];

  for (const entry of entries) {
    if (seenHrefs.has(entry.href)) {
      continue;
    }

    seenHrefs.add(entry.href);
    normalizedEntries.push(entry);

  }

  return normalizedEntries.slice(-maxSessionRouteBreadcrumbEntries);
}

export function recordSessionRouteBreadcrumb(
  entries: SessionRouteBreadcrumbEntry[],
  nextEntry: SessionRouteBreadcrumbEntry,
) {
  const existingIndex = entries.findIndex((entry) => entry.href === nextEntry.href);
  if (existingIndex === -1) {
    return normalizeSessionRouteBreadcrumbs([...entries, nextEntry]);
  }

  const nextEntries = [...entries];
  nextEntries[existingIndex] = nextEntry;
  return normalizeSessionRouteBreadcrumbs(nextEntries);
}

export function removeSessionRouteBreadcrumb(entries: SessionRouteBreadcrumbEntry[], href: string) {
  return entries.filter((entry) => entry.href !== href);
}
