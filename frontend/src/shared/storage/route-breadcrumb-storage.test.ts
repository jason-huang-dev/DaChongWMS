import { expect, test } from "vitest";

import {
  maxSessionRouteBreadcrumbEntries,
  recordSessionRouteBreadcrumb,
  type SessionRouteBreadcrumbEntry,
} from "@/shared/storage/route-breadcrumb-storage";

function buildEntry(index: number): SessionRouteBreadcrumbEntry {
  return {
    href: `/page-${index}`,
    labelKey: `Page ${index}`,
  };
}

test("keeps the original access order when revisiting an existing breadcrumb", () => {
  const entries = [buildEntry(1), buildEntry(2), buildEntry(3)];

  const result = recordSessionRouteBreadcrumb(entries, buildEntry(2));

  expect(result).toEqual([buildEntry(1), buildEntry(2), buildEntry(3)]);
});

test("retains more than twelve recent pages before trimming at the session limit", () => {
  const firstTwelve = Array.from({ length: 12 }, (_, index) => buildEntry(index + 1));

  const result = recordSessionRouteBreadcrumb(firstTwelve, buildEntry(13));

  expect(result).toHaveLength(13);
  expect(result).toEqual([...firstTwelve, buildEntry(13)]);
});

test("caps breadcrumb history at the session limit while keeping the newest appended page", () => {
  const entries = Array.from({ length: maxSessionRouteBreadcrumbEntries }, (_, index) => buildEntry(index + 1));
  const nextEntry = buildEntry(maxSessionRouteBreadcrumbEntries + 1);

  const result = recordSessionRouteBreadcrumb(entries, nextEntry);

  expect(result).toHaveLength(maxSessionRouteBreadcrumbEntries);
  expect(result[result.length - 1]).toEqual(nextEntry);
  expect(result).not.toContainEqual(buildEntry(1));
});
