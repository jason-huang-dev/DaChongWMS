import { screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { MfaChallengePage } from "@/features/mfa/view/MfaChallengePage";
import { renderWithProviders } from "@/test/render";

test("renders the MFA challenge page without missing translation errors", async () => {
  window.sessionStorage.setItem(
    "dachongwms.auth.pending-mfa",
    JSON.stringify({
      username: "mfa-user",
      challengeId: "challenge-123",
      expiresAt: "2026-03-15T10:30:00Z",
      availableMethods: ["totp", "recovery_code"],
    }),
  );
  const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  renderWithProviders(
    <MemoryRouter>
      <MfaChallengePage />
    </MemoryRouter>,
    { includeAuth: true },
  );

  expect(await screen.findByText("Verify multi-factor authentication")).toBeInTheDocument();
  expect(screen.getByText(/one of your recovery codes for mfa-user/i)).toBeInTheDocument();
  expect(consoleErrorSpy).not.toHaveBeenCalled();
});
