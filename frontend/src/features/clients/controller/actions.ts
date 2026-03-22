import { apiPatch, apiPost } from "@/lib/http";

import { buildClientAccountDetailPath, buildClientAccountsPath } from "@/features/clients/model/api";
import type { ClientAccountFormValues, ClientAccountRecord } from "@/features/clients/model/types";

export function runClientAccountCreate(
  organizationId: number | string,
  values: ClientAccountFormValues,
) {
  return apiPost<ClientAccountRecord>(buildClientAccountsPath(organizationId), values);
}

export function runClientAccountUpdate(
  organizationId: number | string,
  clientAccountId: number,
  values: ClientAccountFormValues,
) {
  return apiPatch<ClientAccountRecord>(buildClientAccountDetailPath(organizationId, clientAccountId), values);
}
