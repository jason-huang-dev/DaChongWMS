import type {
  ClientAccountRecord,
  ClientContactPerson,
  ClientLifecycleStatus,
} from "@/features/clients/model/types";

export type ClientSearchField = "all" | "code" | "name" | "contact" | "company";
export type ClientSearchMode = "contains" | "exact";

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

function sanitizeCsvValue(rawValue: string) {
  const escapedValue = /^[=+\-@]/u.test(rawValue) ? `'${rawValue}` : rawValue;
  return `"${escapedValue.replace(/"/g, "\"\"")}"`;
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

export function matchesClientSearch(
  record: ClientAccountRecord,
  field: ClientSearchField,
  rawQuery: string,
  mode: ClientSearchMode,
) {
  const query = normalize(rawQuery);
  if (!query) {
    return true;
  }

  const contactPeople = listClientContactPeople(record);
  const searchableValuesByField: Record<ClientSearchField, string[]> = {
    all: [
      record.code,
      record.name,
      record.company_name ?? "",
      record.contact_name,
      record.contact_email,
      record.contact_phone,
      record.billing_email,
      record.notes,
      ...contactPeople.flatMap((person) => [person.name, person.email ?? "", person.phone ?? ""]),
    ],
    code: [record.code],
    name: [record.name],
    contact: [
      record.contact_name,
      record.contact_email,
      record.contact_phone,
      ...contactPeople.flatMap((person) => [person.name, person.email ?? "", person.phone ?? ""]),
    ],
    company: [record.company_name ?? record.name],
  };

  return searchableValuesByField[field].some((value) => {
    const normalizedValue = normalize(value);
    return mode === "exact" ? normalizedValue === query : normalizedValue.includes(query);
  });
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
