import { ApiClientError } from "@/lib/http";

function flattenObjectMessages(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(flattenObjectMessages);
  }
  if (value && typeof value === "object") {
    return Object.values(value).flatMap(flattenObjectMessages);
  }
  return [];
}

export function parseApiError(error: unknown): string {
  if (error instanceof ApiClientError) {
    const payload = error.payload;
    if (payload && typeof payload === "object") {
      const record = payload as Record<string, unknown>;
      if (typeof record.detail === "string") {
        return record.detail;
      }
      if (typeof record.msg === "string") {
        return record.msg;
      }
      const messages = flattenObjectMessages(payload);
      if (messages.length > 0) {
        return messages.join(" ");
      }
    }
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "An unexpected error occurred.";
}
