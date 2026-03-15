export function parseJsonObject(value: string, fieldName = "JSON") {
  const trimmed = value.trim();
  if (!trimmed) {
    return {} as Record<string, unknown>;
  }

  const parsed = JSON.parse(trimmed) as unknown;
  if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error(`${fieldName} must be a JSON object`);
  }
  return parsed as Record<string, unknown>;
}

export function safeJsonStringify(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}
