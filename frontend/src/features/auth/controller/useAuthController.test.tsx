import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";

import { useAuth } from "@/features/auth/controller/useAuthController";
import { saveStoredSession } from "@/shared/storage/auth-storage";
import { installFetchMock, jsonResponse } from "@/test/fetch";
import { renderWithProviders } from "@/test/render";

function AuthProbe() {
  const { session, status } = useAuth();
  return (
    <div>
      <span>{status}</span>
      <span>{session?.operatorName ?? "--"}</span>
      <span>{session?.operatorRole ?? "--"}</span>
    </div>
  );
}

function SignupProbe() {
  const { session, signup, status } = useAuth();

  return (
    <div>
      <button
        onClick={() =>
          signup({
            name: "new-manager",
            email: "new-manager@example.com",
            password1: "StrongPassword123!",
            password2: "StrongPassword123!",
          })
        }
        type="button"
      >
        Sign up
      </button>
      <span>{status}</span>
      <span>{session?.username ?? "--"}</span>
      <span>{session?.operatorName ?? "--"}</span>
    </div>
  );
}

function LoginProbe() {
  const { login, session, status } = useAuth();

  return (
    <div>
      <button onClick={() => login("login-user", "StrongPassword123!")} type="button">
        Sign in
      </button>
      <span>{status}</span>
      <span>{session?.username ?? "--"}</span>
      <span>{session?.operatorName ?? "--"}</span>
    </div>
  );
}

function LoginChallengeProbe() {
  const { completeMfaChallenge, login, pendingChallenge, session, status } = useAuth();

  return (
    <div>
      <button onClick={() => login("mfa-user", "StrongPassword123!")} type="button">
        Sign in
      </button>
      <button onClick={() => completeMfaChallenge("123456")} type="button">
        Complete challenge
      </button>
      <span>{status}</span>
      <span>{pendingChallenge?.challengeId ?? "--"}</span>
      <span>{session?.operatorName ?? "--"}</span>
    </div>
  );
}

function BootstrapProbe() {
  const { bootstrap, session, status } = useAuth();

  return (
    <div>
      <button onClick={() => bootstrap()} type="button">
        Bootstrap
      </button>
      <span>{status}</span>
      <span>{session?.username ?? "--"}</span>
      <span>{session?.operatorName ?? "--"}</span>
    </div>
  );
}

test("restores a stored session and hydrates the operator profile", async () => {
  saveStoredSession({
    username: "worker",
    openid: "tenant-openid",
    token: "session-token-7",
    operatorId: 7,
    operatorName: "",
    operatorRole: "",
  });

  installFetchMock((url, init) => {
    if (url.pathname === "/api/staff/7/") {
      const headers = new Headers(init?.headers);
      expect(headers.get("TOKEN")).toBe("session-token-7");
      expect(headers.get("OPERATOR")).toBe("7");
      return jsonResponse({
        id: 7,
        staff_name: "Warehouse Worker",
        staff_type: "Manager",
        check_code: 8888,
        create_time: "2026-03-14 09:00:00",
        update_time: "2026-03-14 09:00:00",
        error_check_code_counter: 0,
        is_lock: false,
      });
    }
    return undefined;
  });

  renderWithProviders(<AuthProbe />, { includeAuth: true });

  expect(await screen.findByText("authenticated")).toBeInTheDocument();
  expect(screen.getByText("Warehouse Worker")).toBeInTheDocument();
  expect(screen.getByText("Manager")).toBeInTheDocument();
});

test("signs up a new workspace user and hydrates the operator profile", async () => {
  const user = userEvent.setup();

  installFetchMock((url, init) => {
    if (url.pathname === "/api/signup/") {
      expect(init?.method).toBe("POST");
      return jsonResponse({
        code: "200",
        data: {
          name: "new-manager",
          openid: "tenant-openid",
          token: "signup-token-42",
          user_id: 42,
          email: "new-manager@example.com",
          mfa_enrollment_required: true,
        },
        msg: "success",
      });
    }

    if (url.pathname === "/api/staff/42/") {
      const headers = new Headers(init?.headers);
      expect(headers.get("TOKEN")).toBe("signup-token-42");
      expect(headers.get("OPERATOR")).toBe("42");
      return jsonResponse({
        id: 42,
        staff_name: "New Manager",
        staff_type: "Manager",
        check_code: 8888,
        create_time: "2026-03-15 09:00:00",
        update_time: "2026-03-15 09:00:00",
        error_check_code_counter: 0,
        is_lock: false,
      });
    }

    return undefined;
  });

  renderWithProviders(<SignupProbe />, { includeAuth: true });
  await user.click(screen.getByRole("button", { name: "Sign up" }));

  await waitFor(() => {
    expect(screen.getByText("authenticated")).toBeInTheDocument();
  });
  expect(screen.getByText("new-manager")).toBeInTheDocument();
  expect(screen.getByText("New Manager")).toBeInTheDocument();
});

test("prefetches dashboard workbench preferences after a successful login", async () => {
  const user = userEvent.setup();

  const fetchMock = installFetchMock((url, init) => {
    if (url.pathname === "/api/login/") {
      expect(init?.method).toBe("POST");
      return jsonResponse({
        code: "200",
        data: {
          name: "login-user",
          openid: "tenant-openid",
          token: "login-token-11",
          user_id: 11,
          company_id: 5,
          company_name: "Test System Organization",
          membership_id: 13,
          mfa_enrollment_required: false,
        },
        msg: "success",
      });
    }

    if (url.pathname === "/api/staff/11/") {
      const headers = new Headers(init?.headers);
      expect(headers.get("TOKEN")).toBe("login-token-11");
      expect(headers.get("OPERATOR")).toBe("11");
      return jsonResponse({
        id: 11,
        staff_name: "Login Manager",
        staff_type: "Manager",
        check_code: 8888,
        create_time: "2026-03-25 09:00:00",
        update_time: "2026-03-25 09:00:00",
        error_check_code_counter: 0,
        is_lock: false,
      });
    }

    return undefined;
  });

  renderWithProviders(<LoginProbe />, { includeAuth: true });
  await user.click(screen.getByRole("button", { name: "Sign in" }));

  await waitFor(() => {
    expect(screen.getByText("authenticated")).toBeInTheDocument();
  });
  expect(screen.getByText("login-user")).toBeInTheDocument();
  expect(screen.getByText("Login Manager")).toBeInTheDocument();

  await waitFor(() => {
    expect(
      fetchMock.mock.calls.some(([input, init]) => {
        const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        const url = new URL(rawUrl, "http://localhost");
        if (url.pathname !== "/api/access/workbench-preferences/current/") {
          return false;
        }
        const headers = new Headers(init?.headers);
        return (
          url.searchParams.get("page_key") === "dashboard" &&
          headers.get("TOKEN") === "login-token-11" &&
          headers.get("OPERATOR") === "11" &&
          headers.get("OPENID") === "tenant-openid"
        );
      }),
    ).toBe(true);
  });
});

test("stores a pending MFA challenge and completes it into an authenticated session", async () => {
  const user = userEvent.setup();

  installFetchMock((url, init) => {
    if (url.pathname === "/api/login/") {
      expect(init?.method).toBe("POST");
      return jsonResponse({
        code: "200",
        data: {
          name: "mfa-user",
          mfa_required: true,
          challenge_id: "challenge-123",
          available_methods: ["totp", "recovery_code"],
          expires_at: "2026-03-15T10:30:00Z",
        },
        msg: "MFA challenge required",
      });
    }

    if (url.pathname === "/api/mfa/challenges/verify/") {
      expect(init?.method).toBe("POST");
      return jsonResponse({
        code: "200",
        data: {
          name: "mfa-user",
          openid: "tenant-openid",
          token: "mfa-token-9",
          user_id: 9,
          mfa_verified: true,
          mfa_method: "TOTP",
          mfa_enrollment_required: false,
        },
        msg: "success",
      });
    }

    if (url.pathname === "/api/staff/9/") {
      const headers = new Headers(init?.headers);
      expect(headers.get("TOKEN")).toBe("mfa-token-9");
      expect(headers.get("OPERATOR")).toBe("9");
      return jsonResponse({
        id: 9,
        staff_name: "MFA Manager",
        staff_type: "Manager",
        check_code: 8888,
        create_time: "2026-03-15 09:00:00",
        update_time: "2026-03-15 09:00:00",
        error_check_code_counter: 0,
        is_lock: false,
      });
    }

    return undefined;
  });

  renderWithProviders(<LoginChallengeProbe />, { includeAuth: true });

  await user.click(screen.getByRole("button", { name: "Sign in" }));
  expect(await screen.findByText("challenge-123")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Complete challenge" }));
  await waitFor(() => {
    expect(screen.getByText("authenticated")).toBeInTheDocument();
  });
  expect(screen.getByText("MFA Manager")).toBeInTheDocument();
});

test("bootstraps into the stable default development user and hydrates the operator profile", async () => {
  const user = userEvent.setup();

  installFetchMock((url, init) => {
    if (url.pathname === "/api/test-system/register/") {
      expect(init?.method).toBe("POST");
      return jsonResponse({
        code: "200",
        data: {
          name: "Test System Admin",
          openid: "test-system-organization",
          token: "bootstrap-token",
          user_id: 7,
          company_id: 3,
          company_name: "Test System Organization",
          membership_id: 9,
          mfa_enrollment_required: false,
          used_default_name: true,
          used_default_password: true,
          seed_summary: {
            users: 0,
            organizations: 0,
            memberships: 0,
            warehouses: 0,
          },
        },
        msg: "success",
      });
    }

    if (url.pathname === "/api/staff/7/") {
      const headers = new Headers(init?.headers);
      expect(headers.get("TOKEN")).toBe("bootstrap-token");
      expect(headers.get("OPERATOR")).toBe("7");
      return jsonResponse({
        id: 7,
        staff_name: "Test System Admin",
        staff_type: "Owner",
        check_code: 8888,
        create_time: "2026-03-24 09:00:00",
        update_time: "2026-03-24 09:00:00",
        error_check_code_counter: 0,
        is_lock: false,
      });
    }

    return undefined;
  });

  renderWithProviders(<BootstrapProbe />, { includeAuth: true });
  await user.click(screen.getByRole("button", { name: "Bootstrap" }));

  await waitFor(() => {
    expect(screen.getByText("authenticated")).toBeInTheDocument();
  });
  expect(screen.getAllByText("Test System Admin")).toHaveLength(2);
});
