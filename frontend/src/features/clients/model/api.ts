export function buildClientAccountsPath(organizationId: number | string) {
  return `/api/v1/organizations/${organizationId}/customer-accounts/`;
}

export function buildClientAccountDetailPath(organizationId: number | string, clientAccountId: number) {
  return `${buildClientAccountsPath(organizationId)}${clientAccountId}/`;
}
