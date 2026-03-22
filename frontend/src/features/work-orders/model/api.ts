export function buildWorkOrderTypesPath(organizationId: number | string) {
  return `/api/v1/organizations/${organizationId}/work-order-types/`;
}

export function buildWorkOrderTypeDetailPath(organizationId: number | string, workOrderTypeId: number) {
  return `${buildWorkOrderTypesPath(organizationId)}${workOrderTypeId}/`;
}

export function buildWorkOrdersPath(organizationId: number | string) {
  return `/api/v1/organizations/${organizationId}/work-orders/`;
}

export function buildWorkOrderDetailPath(organizationId: number | string, workOrderId: number) {
  return `${buildWorkOrdersPath(organizationId)}${workOrderId}/`;
}

