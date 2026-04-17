function parseBooleanEnv(value: string | undefined, fallback: boolean) {
  if (value === undefined) {
    return fallback;
  }

  return value === "1" || value.toLowerCase() === "true";
}

export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || "/api",
  enableTestSystem: parseBooleanEnv(import.meta.env.VITE_ENABLE_TEST_SYSTEM, true),
} as const;
