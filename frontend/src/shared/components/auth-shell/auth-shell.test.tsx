import { screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { AuthShell } from "@/shared/components/auth-shell";
import { renderWithProviders } from "@/test/render";

function renderAuthShell() {
  return renderWithProviders(
    <AuthShell
      description="Sign in with your warehouse account. The frontend uses the backend login endpoint and keeps the tenant token and operator id in browser storage for API access."
      title="Sign in to the operator console"
    >
      <div>content</div>
    </AuthShell>,
  );
}

test("uses the translated auth eyebrow by default in English without logging missing keys", () => {
  const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  renderAuthShell();

  expect(screen.getByText("大虫WMS")).toBeInTheDocument();
  expect(consoleErrorSpy).not.toHaveBeenCalled();
});

test("uses the translated auth eyebrow by default in Chinese without logging missing keys", () => {
  window.localStorage.setItem(
    "dachongwms.ui-preferences",
    JSON.stringify({ locale: "zh-CN", themeMode: "light" }),
  );
  const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  renderAuthShell();

  expect(screen.getByText("大虫WMS")).toBeInTheDocument();
  expect(consoleErrorSpy).not.toHaveBeenCalled();
});
