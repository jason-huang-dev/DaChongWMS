import { apiPatch, apiPost } from "@/lib/http";

import {
  buildDistributionProductDetailPath,
  buildDistributionProductsPath,
  buildProductDetailPath,
  buildProductMarkDetailPath,
  buildProductMarksPath,
  buildProductPackagingDetailPath,
  buildProductPackagingPath,
  buildProductsPath,
  buildProductSerialManagementPath,
} from "@/features/products/model/api";
import type {
  DistributionProductRecord,
  ProductMarkRecord,
  ProductPackagingRecord,
  ProductRecord,
  ProductSerialManagementRecord,
} from "@/features/products/model/types";

export function runProductCreate(organizationId: number | string, values: object) {
  return apiPost<ProductRecord>(buildProductsPath(organizationId), values);
}

export function runProductUpdate(organizationId: number | string, productId: number, values: object) {
  return apiPatch<ProductRecord>(buildProductDetailPath(organizationId, productId), values);
}

export function runDistributionProductCreate(organizationId: number | string, productId: number, values: object) {
  return apiPost<DistributionProductRecord>(buildDistributionProductsPath(organizationId, productId), values);
}

export function runDistributionProductUpdate(
  organizationId: number | string,
  productId: number,
  distributionProductId: number,
  values: object,
) {
  return apiPatch<DistributionProductRecord>(
    buildDistributionProductDetailPath(organizationId, productId, distributionProductId),
    values,
  );
}

export function runProductSerialManagementUpdate(organizationId: number | string, productId: number, values: object) {
  return apiPatch<ProductSerialManagementRecord>(buildProductSerialManagementPath(organizationId, productId), values);
}

export function runProductPackagingCreate(organizationId: number | string, productId: number, values: object) {
  return apiPost<ProductPackagingRecord>(buildProductPackagingPath(organizationId, productId), values);
}

export function runProductPackagingUpdate(
  organizationId: number | string,
  productId: number,
  packagingId: number,
  values: object,
) {
  return apiPatch<ProductPackagingRecord>(buildProductPackagingDetailPath(organizationId, productId, packagingId), values);
}

export function runProductMarkCreate(organizationId: number | string, productId: number, values: object) {
  return apiPost<ProductMarkRecord>(buildProductMarksPath(organizationId, productId), values);
}

export function runProductMarkUpdate(
  organizationId: number | string,
  productId: number,
  productMarkId: number,
  values: object,
) {
  return apiPatch<ProductMarkRecord>(buildProductMarkDetailPath(organizationId, productId, productMarkId), values);
}
