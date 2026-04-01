export interface SessionRouteBreadcrumbEntry {
  href: string;
  labelKey: string;
}

const storageKey = "dachongwms.route-breadcrumbs";
export const maxSessionRouteBreadcrumbEntries = 100;
const redirectPathAliases = new Map<string, string>([
  ["/", "/dashboard"],
  ["/inventory/balances", "/inventory"],
]);

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

function buildSessionRouteBreadcrumbPathKey(href: string) {
  try {
    const url = new URL(href, "https://dachongwms.local");
    const normalizedPathname = url.pathname !== "/" ? url.pathname.replace(/\/+$/, "") : url.pathname;
    return redirectPathAliases.get(normalizedPathname) ?? normalizedPathname;
  } catch {
    const [rawPathname = "/"] = href.split(/[?#]/u);
    const normalizedPathname = rawPathname === "/" ? rawPathname : rawPathname.replace(/\/+$/, "") || "/";
    return redirectPathAliases.get(normalizedPathname) ?? normalizedPathname;
  }
}

function normalizeSessionRouteBreadcrumbs(entries: SessionRouteBreadcrumbEntry[]) {
  const entryIndexesByPathKey = new Map<string, number>();
  const normalizedEntries: SessionRouteBreadcrumbEntry[] = [];

  for (const entry of entries) {
    const pathKey = buildSessionRouteBreadcrumbPathKey(entry.href);
    const existingIndex = entryIndexesByPathKey.get(pathKey);
    if (existingIndex === undefined) {
      entryIndexesByPathKey.set(pathKey, normalizedEntries.length);
      normalizedEntries.push(entry);
      continue;
    }

    normalizedEntries[existingIndex] = entry;
  }

  return normalizedEntries.slice(-maxSessionRouteBreadcrumbEntries);
}

export function recordSessionRouteBreadcrumb(
  entries: SessionRouteBreadcrumbEntry[],
  nextEntry: SessionRouteBreadcrumbEntry,
) {
  const nextPathKey = buildSessionRouteBreadcrumbPathKey(nextEntry.href);
  const existingIndex = entries.findIndex((entry) => buildSessionRouteBreadcrumbPathKey(entry.href) === nextPathKey);
  if (existingIndex === -1) {
    return normalizeSessionRouteBreadcrumbs([...entries, nextEntry]);
  }

  const nextEntries = [...entries];
  nextEntries[existingIndex] = nextEntry;
  return normalizeSessionRouteBreadcrumbs(nextEntries);
}

export function removeSessionRouteBreadcrumb(entries: SessionRouteBreadcrumbEntry[], href: string) {
  const removedPathKey = buildSessionRouteBreadcrumbPathKey(href);
  return entries.filter((entry) => buildSessionRouteBreadcrumbPathKey(entry.href) !== removedPathKey);
}
