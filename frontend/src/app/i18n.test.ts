import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

import { msg, resolveTranslatableText, resolveTranslation } from "@/app/i18n";

function collectSourceFiles(rootDirectory: string): string[] {
  return readdirSync(rootDirectory).flatMap((entry) => {
    const absolutePath = join(rootDirectory, entry);
    const entryStats = statSync(absolutePath);

    if (entryStats.isDirectory()) {
      return collectSourceFiles(absolutePath);
    }

    if (!/\.(ts|tsx)$/.test(entry) || /\.test\.(ts|tsx)$/.test(entry)) {
      return [];
    }

    return [absolutePath];
  });
}

function collectLiteralTranslationKeys(fileContents: string) {
  const translationKeys = new Set<string>();
  const literalFunctionPatterns = [
    /\bt\(\s*(["'])(.*?)\1/g,
    /\btranslate\(\s*(["'])(.*?)\1/g,
    /\bmsg\(\s*(["'])(.*?)\1/g,
  ];

  literalFunctionPatterns.forEach((pattern) => {
    for (const match of fileContents.matchAll(pattern)) {
      const key = match[2]?.trim();
      if (key) {
        translationKeys.add(key);
      }
    }
  });

  return translationKeys;
}

describe("i18n", () => {
  test("resolves keyed translations with interpolation", () => {
    expect(resolveTranslation("zh-CN", "filters.activeCount", { count: 3 })).toBe("已启用 3 个筛选条件");
  });

  test("resolves message descriptors with interpolation", () => {
    expect(resolveTranslatableText("zh-CN", msg("shell.workspaceChip", { label: "Ops" }))).toBe("工作空间：Ops");
    expect(resolveTranslatableText("zh-CN", msg("shell.warehouseChip", { label: "Main Warehouse" }))).toBe(
      "仓库：Main Warehouse",
    );
  });

  test("translates catalog-backed source text keys", () => {
    expect(resolveTranslation("zh-CN", "Open returns workspace")).toBe("打开退货工作台");
    expect(resolveTranslation("zh-CN", "Success")).toBe("成功");
  });

  test("throws for unknown translation keys", () => {
    expect(() => resolveTranslation("zh-CN", "__missing.translation.key__")).toThrow(
      'Missing translation key "__missing.translation.key__" for locale "zh-CN".',
    );
  });

  test("covers every literal translation key used in application source", () => {
    const sourceRoot = join(process.cwd(), "src");
    const sourceFiles = collectSourceFiles(sourceRoot);
    const literalTranslationKeys = new Set<string>();

    sourceFiles.forEach((sourceFile) => {
      const fileContents = readFileSync(sourceFile, "utf8");
      const fileKeys = collectLiteralTranslationKeys(fileContents);
      fileKeys.forEach((key) => literalTranslationKeys.add(key));
    });

    const missingKeys = Array.from(literalTranslationKeys).flatMap((key) =>
      ["en", "zh-CN"].flatMap((locale) => {
        try {
          resolveTranslation(locale as "en" | "zh-CN", key);
          return [];
        } catch {
          return [`${locale}: ${key}`];
        }
      }),
    );

    expect(missingKeys).toEqual([]);
  });
});
