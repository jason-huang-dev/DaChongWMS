import { screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { installFetchMock, jsonResponse } from "@/test/fetch";
import { renderWithRouter } from "@/test/render";

test("renders configured social provider buttons on the login page", async () => {
  window.history.replaceState({}, "", "/login");

  installFetchMock((url) => {
    if (url.pathname === "/api/v1/auth/social/providers/") {
      return jsonResponse({
        count: 3,
        results: [
          { id: "google", label: "Google", login_url: "https://backend.test/api/v1/auth/social/google/begin/" },
          { id: "apple", label: "Apple", login_url: "https://backend.test/api/v1/auth/social/apple/begin/" },
          { id: "weixin", label: "WeChat", login_url: "https://backend.test/api/v1/auth/social/weixin/begin/" },
        ],
      });
    }
    return undefined;
  });

  renderWithRouter(["/login"]);

  expect(await screen.findByRole("button", { name: "Google" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Apple" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "WeChat" })).toBeInTheDocument();
});
