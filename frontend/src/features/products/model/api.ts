export function buildProductsPath(organizationId: number | string) {
  return `/api/v1/organizations/${organizationId}/products/`;
}

export function buildProductDetailPath(organizationId: number | string, productId: number) {
  return `${buildProductsPath(organizationId)}${productId}/`;
}

export function buildDistributionProductsPath(organizationId: number | string, productId: number) {
  return `${buildProductDetailPath(organizationId, productId)}distribution-products/`;
}

export function buildDistributionProductDetailPath(
  organizationId: number | string,
  productId: number,
  distributionProductId: number,
) {
  return `${buildDistributionProductsPath(organizationId, productId)}${distributionProductId}/`;
}

export function buildProductSerialManagementPath(organizationId: number | string, productId: number) {
  return `${buildProductDetailPath(organizationId, productId)}serial-management/`;
}

export function buildProductPackagingPath(organizationId: number | string, productId: number) {
  return `${buildProductDetailPath(organizationId, productId)}packaging/`;
}

export function buildProductPackagingDetailPath(
  organizationId: number | string,
  productId: number,
  packagingId: number,
) {
  return `${buildProductPackagingPath(organizationId, productId)}${packagingId}/`;
}

export function buildProductMarksPath(organizationId: number | string, productId: number) {
  return `${buildProductDetailPath(organizationId, productId)}marks/`;
}

export function buildProductMarkDetailPath(organizationId: number | string, productId: number, productMarkId: number) {
  return `${buildProductMarksPath(organizationId, productId)}${productMarkId}/`;
}
