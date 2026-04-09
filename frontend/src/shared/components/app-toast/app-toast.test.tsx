import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";

import { AppToast } from "@/shared/components/app-toast";
import { renderWithProviders } from "@/test/render";

test("renders the toast message with the requested severity", () => {
  renderWithProviders(
    <AppToast
      message="Client account opened successfully."
      onClose={vi.fn()}
      open
      severity="success"
    />,
  );

  expect(screen.getByText("Client account opened successfully.")).toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent("Client account opened successfully.");
});

test("calls onClose when the toast close action is pressed", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();

  renderWithProviders(
    <AppToast
      message="Portal access is not wired yet."
      onClose={onClose}
      open
      severity="info"
    />,
  );

  await user.click(screen.getByLabelText("Close"));

  expect(onClose).toHaveBeenCalledTimes(1);
});
