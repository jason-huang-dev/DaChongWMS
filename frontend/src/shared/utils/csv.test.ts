import { afterEach, expect, test, vi } from "vitest";

import { downloadCsvFile, escapeCsvValue } from "@/shared/utils/csv";

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: originalCreateObjectURL,
    writable: true,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: originalRevokeObjectURL,
    writable: true,
  });
});

test("escapeCsvValue quotes values and guards spreadsheet formula payloads", () => {
  expect(escapeCsvValue('hello "world"')).toBe('"hello ""world"""');
  expect(escapeCsvValue("=SUM(A1:A3)")).toBe('"\'=SUM(A1:A3)"');
  expect(escapeCsvValue("@unsafe")).toBe('"\'@unsafe"');
});

test("downloadCsvFile creates and revokes a csv object url", () => {
  const createObjectUrlMock = vi.fn(() => "blob:csv");
  const revokeObjectUrlMock = vi.fn();
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectUrlMock, writable: true });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectUrlMock, writable: true });

  const appendSpy = vi.spyOn(document.body, "append");
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  const removeSpy = vi.spyOn(HTMLAnchorElement.prototype, "remove").mockImplementation(() => {});

  expect(downloadCsvFile("sku,qty\nA,1", "inventory.csv")).toBe(true);
  expect(createObjectUrlMock).toHaveBeenCalledOnce();
  expect(clickSpy).toHaveBeenCalledOnce();
  expect(appendSpy).toHaveBeenCalledOnce();
  expect(removeSpy).toHaveBeenCalledOnce();
  expect(revokeObjectUrlMock).toHaveBeenCalledWith("blob:csv");
});
