import { afterEach, expect, test } from "vitest";

import { apiGet, apiPost } from "@/lib/http";
import { clearStoredSession, saveStoredSession } from "@/shared/storage/auth-storage";
import { installFetchMock, jsonResponse } from "@/test/fetch";

afterEach(() => {
  clearStoredSession();
});

test("apiGet reuses the stored session for authenticated requests", async () => {
  saveStoredSession({
    username: "manager",
    openid: "tenant-openid",
    token: "session-token-7",
    operatorId: 7,
    operatorName: "Warehouse Manager",
    operatorRole: "Manager",
    membershipId: 3,
  });

  installFetchMock((url, init) => {
    if (url.pathname !== "/api/warehouse/") {
      return undefined;
    }

    const headers = new Headers(init?.headers);
    expect(headers.get("TOKEN")).toBe("session-token-7");
    expect(headers.get("Authorization")).toBeNull();
    expect(headers.get("OPENID")).toBe("tenant-openid");
    expect(headers.get("OPERATOR")).toBe("7");
    return jsonResponse({ count: 0, next: null, previous: null, results: [] });
  });

  await expect(apiGet("/api/warehouse/", { page: 1, page_size: 100 })).resolves.toEqual({
    count: 0,
    next: null,
    previous: null,
    results: [],
  });
});

test("allowAnonymous requests do not attach the stored session", async () => {
  saveStoredSession({
    username: "manager",
    openid: "tenant-openid",
    token: "session-token-7",
    operatorId: 7,
    operatorName: "Warehouse Manager",
    operatorRole: "Manager",
    membershipId: 3,
  });

  installFetchMock((url, init) => {
    if (url.pathname !== "/api/login/") {
      return undefined;
    }

    const headers = new Headers(init?.headers);
    expect(headers.get("TOKEN")).toBeNull();
    expect(headers.get("Authorization")).toBeNull();
    expect(headers.get("OPENID")).toBeNull();
    expect(headers.get("OPERATOR")).toBeNull();
    return jsonResponse({ code: "200", msg: "success", data: {} });
  });

  await expect(apiPost("/api/login/", { name: "manager", password: "secret123" }, null, true)).resolves.toEqual({
    code: "200",
    msg: "success",
    data: {},
  });
});
