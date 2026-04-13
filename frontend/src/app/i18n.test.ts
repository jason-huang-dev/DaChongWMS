import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, test, vi } from "vitest";

import { msg, resolveTranslatableText, resolveTranslatableTextStrict, resolveTranslation, resolveTranslationStrict } from "@/app/i18n";

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

function createSourceFile(filePath: string, fileContents: string) {
  return ts.createSourceFile(
    filePath,
    fileContents,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function collectNonLiteralTCalls(sourceFile: ts.SourceFile) {
  const violations: string[] = [];

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "t") {
      const firstArgument = node.arguments[0];
      const isLiteral =
        firstArgument !== undefined &&
        (ts.isStringLiteral(firstArgument) || ts.isNoSubstitutionTemplateLiteral(firstArgument));

      if (!isLiteral) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        violations.push(`${sourceFile.fileName}:${line + 1}:${character + 1}`);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

function collectBareJsxText(sourceFile: ts.SourceFile) {
  const violations: string[] = [];

  function visit(node: ts.Node) {
    if (ts.isJsxText(node)) {
      const normalizedText = node.getText(sourceFile).replace(/\s+/g, " ").trim();
      const hasHumanReadableText = /[A-Za-z]/.test(normalizedText);

      if (hasHumanReadableText) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        violations.push(`${sourceFile.fileName}:${line + 1}:${character + 1} -> ${normalizedText}`);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

function collectFilesUsingTWithoutUseI18nBinding(sourceFiles: string[]) {
  return sourceFiles.filter((sourceFile) => {
    const fileContents = readFileSync(sourceFile, "utf8");
    const usesTFunction = /\bt\(/.test(fileContents);
    if (!usesTFunction) {
      return false;
    }

    return !/const\s+\{[^}]*\bt\b[^}]*\}\s*=\s*useI18n\(\)/s.test(fileContents);
  });
}

const sharedTranslatableJsxProps = new Map<string, ReadonlySet<string>>([
  ["ExceptionLane", new Set(["title", "subtitle", "emptyMessage"])],
  ["FormAutocomplete", new Set(["label", "helperText", "placeholder", "emptyText"])],
  ["FormTextField", new Set(["label", "helperText", "placeholder"])],
  ["MetricCard", new Set(["label"])],
  ["MutationCard", new Set(["title", "description"])],
  ["PageHeader", new Set(["title", "description"])],
  ["ReferenceAutocompleteField", new Set(["label", "helperText", "placeholder", "emptyText"])],
  ["ResourceTable", new Set(["title", "subtitle", "emptyMessage"])],
]);

function collectSharedTranslatablePropViolations(sourceFile: ts.SourceFile) {
  const violations: string[] = [];

  function visit(node: ts.Node) {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      const componentName = ts.isIdentifier(node.tagName) ? node.tagName.text : null;
      const translatableProps = componentName ? sharedTranslatableJsxProps.get(componentName) : undefined;

      if (translatableProps) {
        node.attributes.properties.forEach((attribute) => {
          if (!ts.isJsxAttribute(attribute)) {
            return;
          }

          const attributeName = ts.isIdentifier(attribute.name) ? attribute.name.text : attribute.name.name.text;
          if (!translatableProps.has(attributeName)) {
            return;
          }

          const initializer = attribute.initializer;
          if (!initializer || !ts.isJsxExpression(initializer) || !initializer.expression) {
            return;
          }

          if (
            ts.isCallExpression(initializer.expression) &&
            ts.isIdentifier(initializer.expression.expression) &&
            initializer.expression.expression.text === "t"
          ) {
            const { line, character } = sourceFile.getLineAndCharacterOfPosition(attribute.getStart(sourceFile));
            violations.push(`${sourceFile.fileName}:${line + 1}:${character + 1}`);
          }
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
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

  test("renders a safe fallback for unknown translation keys", () => {
    expect(resolveTranslation("zh-CN", "Order Interception")).toBe("Order Interception");
    expect(resolveTranslation("zh-CN", "shell.missingTranslation")).toBe("[missing: shell.missingTranslation]");
  });

  test("does not report already-localized text as a missing translation key", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(resolveTranslation("zh-CN", "采购单行 1")).toBe("采购单行 1");
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  test("strict resolution throws for unknown translation keys", () => {
    expect(() => resolveTranslationStrict("zh-CN", "__missing.translation.key__")).toThrow(
      'Missing translation key "__missing.translation.key__" for locale "zh-CN".',
    );
    expect(() => resolveTranslatableTextStrict("zh-CN", msg("__missing.translation.key__"))).toThrow(
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
          resolveTranslationStrict(locale as "en" | "zh-CN", key);
          return [];
        } catch {
          return [`${locale}: ${key}`];
        }
      }),
    );

    expect(missingKeys).toEqual([]);
  });

  test("does not use the legacy translateText helper", () => {
    const sourceRoot = join(process.cwd(), "src");
    const sourceFiles = collectSourceFiles(sourceRoot);
    const violations = sourceFiles.filter((sourceFile) => readFileSync(sourceFile, "utf8").includes("translateText("));

    expect(violations).toEqual([]);
  });

  test("restricts t(...) calls to literal catalog keys", () => {
    const sourceRoot = join(process.cwd(), "src");
    const sourceFiles = collectSourceFiles(sourceRoot);
    const violations = sourceFiles.flatMap((sourceFile) =>
      collectNonLiteralTCalls(createSourceFile(sourceFile, readFileSync(sourceFile, "utf8"))),
    );

    expect(violations).toEqual([]);
  });

  test("binds t from useI18n() wherever t(...) is used", () => {
    const sourceRoot = join(process.cwd(), "src");
    const sourceFiles = collectSourceFiles(sourceRoot);
    const violations = collectFilesUsingTWithoutUseI18nBinding(sourceFiles);

    expect(violations).toEqual([]);
  });

  test("passes descriptors or catalog keys to shared translatable component props", () => {
    const sourceRoot = join(process.cwd(), "src");
    const sourceFiles = collectSourceFiles(sourceRoot);
    const violations = sourceFiles.flatMap((sourceFile) =>
      collectSharedTranslatablePropViolations(createSourceFile(sourceFile, readFileSync(sourceFile, "utf8"))),
    );

    expect(violations).toEqual([]);
  });

  test("does not leave untranslated JSX text in application source", () => {
    const sourceRoot = join(process.cwd(), "src");
    const sourceFiles = collectSourceFiles(sourceRoot).filter((sourceFile) => sourceFile.endsWith(".tsx"));
    const violations = sourceFiles.flatMap((sourceFile) =>
      collectBareJsxText(createSourceFile(sourceFile, readFileSync(sourceFile, "utf8"))),
    );

    expect(violations).toEqual([]);
  });
});
