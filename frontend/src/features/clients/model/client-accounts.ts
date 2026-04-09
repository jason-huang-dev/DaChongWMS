import type {
  ClientAccountRecord,
  ClientContactPerson,
  ClientLifecycleStatus,
} from "@/features/clients/model/types";
import { formatDateTime, formatNumber, formatStatusLabel } from "@/shared/utils/format";

export type ClientSearchField =
  | "all"
  | "customerCode"
  | "customerName"
  | "customerContact"
  | "contactEmail"
  | "contactPhone"
  | "companyName"
  | "companyContact"
  | "warehouse"
  | "settlementCurrency"
  | "distribution"
  | "chargingTemplate"
  | "inboundState"
  | "dropshipState"
  | "pushDocsState"
  | "createdDate"
  | "updatedDate";

export type ClientCustomerSearchField =
  | "customerCode"
  | "customerName"
  | "customerContact"
  | "contactEmail"
  | "contactPhone";

export type ClientCompanySearchField = "companyName" | "companyContact" | "warehouse" | "settlementCurrency";

export type ClientSetupSearchField =
  | "distribution"
  | "chargingTemplate"
  | "inboundState"
  | "dropshipState"
  | "pushDocsState";

export type ClientTimeField = "createdDate" | "updatedDate";

export type ClientMetricField = "availableBalance" | "creditLimit" | "creditUsed" | "authorizedQty";

type ClientSearchMatchMode = "contains" | "exact";

interface ClientSearchFieldDefinition {
  matchMode: ClientSearchMatchMode;
  readAll: (record: ClientAccountRecord) => string[];
}

export const clientCustomerSearchFieldOptions: Array<{ label: string; value: ClientCustomerSearchField }> = [
  { label: "Customer Code", value: "customerCode" },
  { label: "Customer Name", value: "customerName" },
  { label: "Contact Name", value: "customerContact" },
  { label: "Contact Email", value: "contactEmail" },
  { label: "Contact Phone", value: "contactPhone" },
];

export const clientCompanySearchFieldOptions: Array<{ label: string; value: ClientCompanySearchField }> = [
  { label: "Company Name", value: "companyName" },
  { label: "Company Contact", value: "companyContact" },
  { label: "Warehouse Assignment", value: "warehouse" },
  { label: "Settlement Currency", value: "settlementCurrency" },
];

export const clientSetupSearchFieldOptions: Array<{ label: string; value: ClientSetupSearchField }> = [
  { label: "Charging Template", value: "chargingTemplate" },
  { label: "Distribution Permission", value: "distribution" },
  { label: "Inbound State", value: "inboundState" },
  { label: "Dropship State", value: "dropshipState" },
  { label: "Push-Docs State", value: "pushDocsState" },
];

export const clientTimeFieldOptions: Array<{ label: string; value: ClientTimeField }> = [
  { label: "Created Date", value: "createdDate" },
  { label: "Updated Date", value: "updatedDate" },
];

export const clientSearchPlaceholders: Record<ClientSearchField, string> = {
  all: "Search any visible client field",
  customerCode: "Search customer code",
  customerName: "Search customer name",
  customerContact: "Search contact name",
  contactEmail: "Search contact email",
  contactPhone: "Search contact phone",
  companyName: "Search company name",
  companyContact: "Search company contact",
  warehouse: "Search warehouse assignment",
  settlementCurrency: "Search settlement currency",
  distribution: "Search distribution permission",
  chargingTemplate: "Search charging template",
  inboundState: "Search inbound state",
  dropshipState: "Search dropship state",
  pushDocsState: "Search push-doc state",
  createdDate: "Search created date",
  updatedDate: "Search updated date",
};

export const clientMetricFieldOptions: Array<{ label: string; value: ClientMetricField }> = [
  { label: "Available Balance", value: "availableBalance" },
  { label: "Credit Limit", value: "creditLimit" },
  { label: "Credit Used", value: "creditUsed" },
  { label: "Authorized Qty", value: "authorizedQty" },
];

export const clientLifecycleOrder: ClientLifecycleStatus[] = [
  "PENDING_APPROVAL",
  "APPROVED",
  "REVIEW_NOT_APPROVED",
  "DEACTIVATED",
];

export const clientLifecycleLabels: Record<ClientLifecycleStatus, string> = {
  PENDING_APPROVAL: "Pending approval",
  APPROVED: "Approved",
  REVIEW_NOT_APPROVED: "Review not approved",
  DEACTIVATED: "Deactivated",
};

export const clientLifecycleRouteSegments: Record<ClientLifecycleStatus, string> = {
  PENDING_APPROVAL: "pending-approval",
  APPROVED: "approved",
  REVIEW_NOT_APPROVED: "review-not-approved",
  DEACTIVATED: "deactivated",
};

const clientLifecycleByRouteSegment = Object.fromEntries(
  Object.entries(clientLifecycleRouteSegments).map(([status, slug]) => [slug, status as ClientLifecycleStatus]),
) as Record<string, ClientLifecycleStatus>;

function normalize(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function uniqueSortedValues(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])).sort((left, right) =>
    left.localeCompare(right),
  );
}

function sanitizeCsvValue(rawValue: string) {
  const escapedValue = /^[=+\-@]/u.test(rawValue) ? `'${rawValue}` : rawValue;
  return `"${escapedValue.replace(/"/g, "\"\"")}"`;
}

function matchesExactQueryValue(fieldValue: string, queryValue: string) {
  return normalize(fieldValue) === normalize(queryValue);
}

function matchesContainsQueryValue(fieldValue: string, queryValue: string) {
  return normalize(fieldValue).includes(normalize(queryValue));
}

function formatClientToggleState(value?: boolean | null) {
  return value ? "Enabled" : "Disabled";
}

function buildDateSearchValues(value?: string | null) {
  if (!value) {
    return [];
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return [value];
  }

  return uniqueSortedValues([
    value,
    parsed.toISOString(),
    parsed.toISOString().slice(0, 10),
    formatDateTime(value),
  ]);
}

function buildNumericSearchValues(value?: number | null) {
  if (value === undefined || value === null) {
    return [];
  }

  return uniqueSortedValues([String(value), formatNumber(value)]);
}

export function formatClientDistributionPermission(value?: string | null) {
  if (!value) {
    return "--";
  }
  if (value === "NOT_SUPPORTED") {
    return "Distribution is not supported";
  }
  return formatStatusLabel(value);
}

export function resolveClientLifecycleStatus(record: ClientAccountRecord): ClientLifecycleStatus {
  const explicitStatus = record.approval_status?.toUpperCase();
  if (explicitStatus === "PENDING_APPROVAL" || explicitStatus === "APPROVED" || explicitStatus === "REVIEW_NOT_APPROVED") {
    return explicitStatus;
  }
  if (explicitStatus === "DEACTIVATED") {
    return "DEACTIVATED";
  }
  return record.is_active ? "APPROVED" : "DEACTIVATED";
}

export function buildClientLifecyclePath(status: ClientLifecycleStatus) {
  return `/clients/${clientLifecycleRouteSegments[status]}`;
}

export function resolveClientLifecycleStatusFromRouteSegment(segment?: string | null) {
  if (!segment) {
    return null;
  }
  return clientLifecycleByRouteSegment[segment] ?? null;
}

export function listClientContactPeople(record: ClientAccountRecord): ClientContactPerson[] {
  if (record.contact_people && record.contact_people.length > 0) {
    return record.contact_people.filter(
      (person) => Boolean(person.name || person.email || person.phone),
    );
  }

  if (!record.contact_name && !record.contact_email && !record.contact_phone) {
    return [];
  }

  return [
    {
      name: record.contact_name || "Primary contact",
      email: record.contact_email || undefined,
      phone: record.contact_phone || undefined,
    },
  ];
}

export function buildClientContactSummary(record: ClientAccountRecord) {
  return listClientContactPeople(record)
    .map((person) => person.name)
    .filter(Boolean)
    .join(", ");
}

function buildClientSearchableValues(record: ClientAccountRecord) {
  const contactPeople = listClientContactPeople(record);

  return uniqueSortedValues([
    record.code,
    record.name,
    record.contact_name,
    record.contact_email,
    record.contact_phone,
    record.company_name ?? record.name,
    record.settlement_currency,
    ...contactPeople.flatMap((person) => [person.name, person.email ?? "", person.phone ?? ""]),
    ...(record.warehouse_assignments ?? []),
    formatClientDistributionPermission(record.distribution_mode),
    record.distribution_mode ?? "",
    record.charging_template_name ?? "",
    formatClientToggleState(record.allow_inbound_goods),
    formatClientToggleState(record.allow_dropshipping_orders),
    formatClientToggleState(record.limit_balance_documents),
    ...buildDateSearchValues(record.create_time),
    ...buildDateSearchValues(record.update_time),
    ...buildNumericSearchValues(record.total_available_balance),
    ...buildNumericSearchValues(record.credit_limit),
    ...buildNumericSearchValues(record.credit_used),
    ...buildNumericSearchValues(record.authorized_order_quantity),
  ]);
}

const clientSearchFieldDefinitions: Record<ClientSearchField, ClientSearchFieldDefinition> = {
  all: {
    matchMode: "contains",
    readAll: (record) => buildClientSearchableValues(record),
  },
  customerCode: {
    matchMode: "contains",
    readAll: (record) => uniqueSortedValues([record.code]),
  },
  customerName: {
    matchMode: "contains",
    readAll: (record) => uniqueSortedValues([record.name]),
  },
  customerContact: {
    matchMode: "contains",
    readAll: (record) => uniqueSortedValues([record.contact_name]),
  },
  contactEmail: {
    matchMode: "contains",
    readAll: (record) => uniqueSortedValues([record.contact_email]),
  },
  contactPhone: {
    matchMode: "contains",
    readAll: (record) => uniqueSortedValues([record.contact_phone]),
  },
  companyName: {
    matchMode: "contains",
    readAll: (record) => uniqueSortedValues([record.company_name ?? record.name]),
  },
  companyContact: {
    matchMode: "contains",
    readAll: (record) =>
      uniqueSortedValues(
        listClientContactPeople(record).flatMap((person) => [person.name, person.email ?? "", person.phone ?? ""]),
      ),
  },
  warehouse: {
    matchMode: "contains",
    readAll: (record) => uniqueSortedValues(record.warehouse_assignments ?? []),
  },
  settlementCurrency: {
    matchMode: "contains",
    readAll: (record) => uniqueSortedValues([record.settlement_currency]),
  },
  distribution: {
    matchMode: "contains",
    readAll: (record) => uniqueSortedValues([formatClientDistributionPermission(record.distribution_mode), record.distribution_mode]),
  },
  chargingTemplate: {
    matchMode: "contains",
    readAll: (record) => uniqueSortedValues([record.charging_template_name]),
  },
  inboundState: {
    matchMode: "contains",
    readAll: (record) => uniqueSortedValues([formatClientToggleState(record.allow_inbound_goods)]),
  },
  dropshipState: {
    matchMode: "contains",
    readAll: (record) => uniqueSortedValues([formatClientToggleState(record.allow_dropshipping_orders)]),
  },
  pushDocsState: {
    matchMode: "contains",
    readAll: (record) => uniqueSortedValues([formatClientToggleState(record.limit_balance_documents)]),
  },
  createdDate: {
    matchMode: "contains",
    readAll: (record) => buildDateSearchValues(record.create_time),
  },
  updatedDate: {
    matchMode: "contains",
    readAll: (record) => buildDateSearchValues(record.update_time),
  },
};

export function matchesClientSearch(
  record: ClientAccountRecord,
  field: ClientSearchField,
  rawQuery: string,
) {
  const query = normalize(rawQuery);
  if (!query) {
    return true;
  }

  const definition = clientSearchFieldDefinitions[field];
  return definition.readAll(record).some((value) =>
    definition.matchMode === "exact" ? matchesExactQueryValue(value, rawQuery) : matchesContainsQueryValue(value, rawQuery),
  );
}

export function readClientMetricValue(record: ClientAccountRecord, field: ClientMetricField) {
  switch (field) {
    case "creditLimit":
      return record.credit_limit ?? 0;
    case "creditUsed":
      return record.credit_used ?? 0;
    case "authorizedQty":
      return record.authorized_order_quantity ?? 0;
    case "availableBalance":
    default:
      return record.total_available_balance ?? 0;
  }
}

function parseMetricFilterValue(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function matchesClientMetricRange(
  record: ClientAccountRecord,
  field: ClientMetricField,
  rawMin: string,
  rawMax: string,
) {
  const min = parseMetricFilterValue(rawMin);
  const max = parseMetricFilterValue(rawMax);

  if (min === null && max === null) {
    return true;
  }

  const metricValue = readClientMetricValue(record, field);
  if (min !== null && metricValue < min) {
    return false;
  }
  if (max !== null && metricValue > max) {
    return false;
  }
  return true;
}

function parseDateFilterValue(value: string, endOfDay = false) {
  if (!value.trim()) {
    return null;
  }

  const resolvedValue = /^\d{4}-\d{2}-\d{2}$/u.test(value)
    ? `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`
    : value;
  const parsed = new Date(resolvedValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function matchesClientTimeRange(
  record: ClientAccountRecord,
  field: ClientTimeField,
  rawStart: string,
  rawEnd: string,
) {
  const start = parseDateFilterValue(rawStart, false);
  const end = parseDateFilterValue(rawEnd, true);

  if (!start && !end) {
    return true;
  }

  const sourceValue = field === "updatedDate" ? record.update_time : record.create_time;
  if (!sourceValue) {
    return false;
  }

  const recordDate = new Date(sourceValue);
  if (Number.isNaN(recordDate.getTime())) {
    return false;
  }

  if (start && recordDate < start) {
    return false;
  }
  if (end && recordDate > end) {
    return false;
  }

  return true;
}

export function encodeClientMultiValue(values: string[]) {
  const normalizedValues = uniqueSortedValues(values);
  return normalizedValues.length > 0 ? JSON.stringify(normalizedValues) : "";
}

export function decodeClientMultiValue(value: string) {
  if (!value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? uniqueSortedValues(parsed.map((item) => String(item ?? ""))) : [];
  } catch {
    return uniqueSortedValues(value.split(","));
  }
}

export function buildClientAccountsCsvContent(rows: ClientAccountRecord[]) {
  const header = [
    "Status",
    "Client Code",
    "Client Name",
    "Company Name",
    "Contact Person",
    "Contact Email",
    "Contact Phone",
    "Billing Email",
    "Settlement Currency",
    "Distribution",
    "Charging Template",
    "Warehouse Assignments",
    "Dropship Enabled",
    "Inbound Enabled",
    "Active",
    "Notes",
  ];

  const lines = rows.map((row) => {
    const contacts = listClientContactPeople(row);
    return [
      clientLifecycleLabels[resolveClientLifecycleStatus(row)],
      row.code,
      row.name,
      row.company_name ?? row.name,
      contacts.map((person) => person.name).join(" | "),
      contacts.map((person) => person.email ?? "").filter(Boolean).join(" | "),
      contacts.map((person) => person.phone ?? "").filter(Boolean).join(" | "),
      row.billing_email,
      row.settlement_currency ?? "",
      row.distribution_mode ?? "",
      row.charging_template_name ?? "",
      (row.warehouse_assignments ?? []).join(" | "),
      row.allow_dropshipping_orders ? "Yes" : "No",
      row.allow_inbound_goods ? "Yes" : "No",
      row.is_active ? "Yes" : "No",
      row.notes,
    ]
      .map((value) => sanitizeCsvValue(String(value ?? "")))
      .join(",");
  });

  return [header.map(sanitizeCsvValue).join(","), ...lines].join("\n");
}

export function downloadClientAccountsCsv(rows: ClientAccountRecord[], filenamePrefix: string) {
  if (rows.length === 0 || typeof document === "undefined" || typeof URL.createObjectURL !== "function") {
    return;
  }

  const blob = new Blob([buildClientAccountsCsvContent(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filenamePrefix}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
