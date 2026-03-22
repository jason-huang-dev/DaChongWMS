import { useEffect, useMemo, useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useTenantScope } from "@/app/scope-context";
import { buildClientAccountsPath } from "@/features/clients/model/api";
import type { ClientAccountRecord } from "@/features/clients/model/types";
import {
  runDistributionProductCreate,
  runDistributionProductUpdate,
  runProductCreate,
  runProductMarkCreate,
  runProductMarkUpdate,
  runProductPackagingCreate,
  runProductPackagingUpdate,
  runProductSerialManagementUpdate,
  runProductUpdate,
} from "@/features/products/controller/actions";
import {
  buildDistributionProductsPath,
  buildProductMarksPath,
  buildProductPackagingPath,
  buildProductsPath,
  buildProductSerialManagementPath,
} from "@/features/products/model/api";
import {
  defaultDistributionProductFormValues,
  defaultProductFormValues,
  defaultProductMarkFormValues,
  defaultProductPackagingFormValues,
  mapDistributionProductFormToPayload,
  mapDistributionProductToFormValues,
  mapPackagingToFormValues,
  mapProductMarkToFormValues,
  mapProductPackagingFormToPayload,
  mapProductToFormValues,
  mapSerialManagementToFormValues,
} from "@/features/products/model/mappers";
import type {
  DistributionProductFormValues,
  DistributionProductRecord,
  ProductFormValues,
  ProductMarkFormValues,
  ProductMarkRecord,
  ProductPackagingFormValues,
  ProductPackagingRecord,
  ProductRecord,
  ProductSerialManagementFormValues,
  ProductSerialManagementRecord,
} from "@/features/products/model/types";
import { useDataView } from "@/shared/hooks/use-data-view";
import { useResource } from "@/shared/hooks/use-resource";
import { parseApiError } from "@/shared/utils/parse-api-error";

interface FeedbackState {
  successMessage: string | null;
  errorMessage: string | null;
}

function emptyFeedback(): FeedbackState {
  return {
    successMessage: null,
    errorMessage: null,
  };
}

function matchesToggleFilter(filterValue: string, currentValue: boolean) {
  if (filterValue === "") {
    return true;
  }
  return filterValue === "true" ? currentValue : !currentValue;
}

export function useProductsController() {
  const queryClient = useQueryClient();
  const { company } = useTenantScope();
  const [selectedProduct, setSelectedProduct] = useState<ProductRecord | null>(null);
  const [selectedDistributionProduct, setSelectedDistributionProduct] = useState<DistributionProductRecord | null>(null);
  const [selectedPackaging, setSelectedPackaging] = useState<ProductPackagingRecord | null>(null);
  const [selectedProductMark, setSelectedProductMark] = useState<ProductMarkRecord | null>(null);
  const [productFeedback, setProductFeedback] = useState<FeedbackState>(emptyFeedback);
  const [distributionFeedback, setDistributionFeedback] = useState<FeedbackState>(emptyFeedback);
  const [serialFeedback, setSerialFeedback] = useState<FeedbackState>(emptyFeedback);
  const [packagingFeedback, setPackagingFeedback] = useState<FeedbackState>(emptyFeedback);
  const [markFeedback, setMarkFeedback] = useState<FeedbackState>(emptyFeedback);

  const productView = useDataView({
    viewKey: `products.catalog.${company?.openid ?? "anonymous"}`,
    defaultFilters: {
      name: "",
      sku: "",
      is_active: "",
    },
    pageSize: 10,
  });

  const productsQuery = useResource<ProductRecord[]>(
    ["products", "catalog", company?.id],
    buildProductsPath(company?.id ?? "0"),
    undefined,
    { enabled: Boolean(company?.id) },
  );

  const customerAccountsQuery = useResource<ClientAccountRecord[]>(
    ["products", "customer-accounts", company?.id],
    buildClientAccountsPath(company?.id ?? "0"),
    undefined,
    { enabled: Boolean(company?.id && selectedProduct) },
  );

  const distributionProductsQuery = useResource<DistributionProductRecord[]>(
    ["products", "distribution", company?.id, selectedProduct?.id],
    selectedProduct ? buildDistributionProductsPath(company?.id ?? "0", selectedProduct.id) : "",
    undefined,
    { enabled: Boolean(company?.id && selectedProduct?.id) },
  );

  const serialManagementQuery = useResource<ProductSerialManagementRecord>(
    ["products", "serial-management", company?.id, selectedProduct?.id],
    selectedProduct ? buildProductSerialManagementPath(company?.id ?? "0", selectedProduct.id) : "",
    undefined,
    { enabled: Boolean(company?.id && selectedProduct?.id) },
  );

  const packagingQuery = useResource<ProductPackagingRecord[]>(
    ["products", "packaging", company?.id, selectedProduct?.id],
    selectedProduct ? buildProductPackagingPath(company?.id ?? "0", selectedProduct.id) : "",
    undefined,
    { enabled: Boolean(company?.id && selectedProduct?.id) },
  );

  const productMarksQuery = useResource<ProductMarkRecord[]>(
    ["products", "marks", company?.id, selectedProduct?.id],
    selectedProduct ? buildProductMarksPath(company?.id ?? "0", selectedProduct.id) : "",
    undefined,
    { enabled: Boolean(company?.id && selectedProduct?.id) },
  );

  const allProducts = productsQuery.data ?? [];
  const filteredProducts = useMemo(() => {
    const normalizedName = productView.filters.name.trim().toLowerCase();
    const normalizedSku = productView.filters.sku.trim().toLowerCase();

    return allProducts.filter((product) => {
      if (normalizedName && !product.name.toLowerCase().includes(normalizedName)) {
        return false;
      }
      if (normalizedSku && !product.sku.toLowerCase().includes(normalizedSku)) {
        return false;
      }
      if (!matchesToggleFilter(productView.filters.is_active, product.is_active)) {
        return false;
      }
      return true;
    });
  }, [allProducts, productView.filters]);

  const pagedProducts = useMemo(() => {
    const startIndex = (productView.page - 1) * productView.pageSize;
    return filteredProducts.slice(startIndex, startIndex + productView.pageSize);
  }, [filteredProducts, productView.page, productView.pageSize]);

  useEffect(() => {
    setSelectedDistributionProduct(null);
    setSelectedPackaging(null);
    setSelectedProductMark(null);
    setDistributionFeedback(emptyFeedback());
    setSerialFeedback(emptyFeedback());
    setPackagingFeedback(emptyFeedback());
    setMarkFeedback(emptyFeedback());
  }, [selectedProduct?.id]);

  const productDefaultValues = selectedProduct ? mapProductToFormValues(selectedProduct) : defaultProductFormValues;
  const distributionDefaultValues = selectedDistributionProduct
    ? mapDistributionProductToFormValues(selectedDistributionProduct)
    : defaultDistributionProductFormValues;
  const serialDefaultValues = mapSerialManagementToFormValues(
    selectedProduct ? serialManagementQuery.data ?? null : null,
  );
  const packagingDefaultValues = selectedPackaging
    ? mapPackagingToFormValues(selectedPackaging)
    : defaultProductPackagingFormValues;
  const productMarkDefaultValues = selectedProductMark
    ? mapProductMarkToFormValues(selectedProductMark)
    : defaultProductMarkFormValues;

  const invalidateSelectedProductQueries = async (productId: number) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["products", "catalog", company?.id] }),
      queryClient.invalidateQueries({ queryKey: ["products", "distribution", company?.id, productId] }),
      queryClient.invalidateQueries({ queryKey: ["products", "serial-management", company?.id, productId] }),
      queryClient.invalidateQueries({ queryKey: ["products", "packaging", company?.id, productId] }),
      queryClient.invalidateQueries({ queryKey: ["products", "marks", company?.id, productId] }),
    ]);
  };

  const createProductMutation = useMutation({
    mutationFn: (values: ProductFormValues) => {
      if (!company?.id) {
        throw new Error("No active workspace selected");
      }
      return runProductCreate(company.id, values);
    },
    onSuccess: async (product) => {
      setProductFeedback({ successMessage: `Product ${product.sku} created.`, errorMessage: null });
      setSelectedProduct(product);
      await invalidateSelectedProductQueries(product.id);
    },
    onError: (error) => {
      setProductFeedback({ successMessage: null, errorMessage: parseApiError(error) });
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: (values: ProductFormValues) => {
      if (!company?.id || !selectedProduct) {
        throw new Error("No product selected");
      }
      return runProductUpdate(company.id, selectedProduct.id, values);
    },
    onSuccess: async (product) => {
      setProductFeedback({ successMessage: `Product ${product.sku} updated.`, errorMessage: null });
      setSelectedProduct(product);
      await invalidateSelectedProductQueries(product.id);
    },
    onError: (error) => {
      setProductFeedback({ successMessage: null, errorMessage: parseApiError(error) });
    },
  });

  const createDistributionProductMutation = useMutation({
    mutationFn: (values: DistributionProductFormValues) => {
      if (!company?.id || !selectedProduct) {
        throw new Error("No product selected");
      }
      return runDistributionProductCreate(company.id, selectedProduct.id, mapDistributionProductFormToPayload(values));
    },
    onSuccess: async (distributionProduct) => {
      setDistributionFeedback({
        successMessage: `Distribution product ${distributionProduct.external_sku} saved.`,
        errorMessage: null,
      });
      setSelectedDistributionProduct(distributionProduct);
      await invalidateSelectedProductQueries(distributionProduct.product_id);
    },
    onError: (error) => {
      setDistributionFeedback({ successMessage: null, errorMessage: parseApiError(error) });
    },
  });

  const updateDistributionProductMutation = useMutation({
    mutationFn: (values: DistributionProductFormValues) => {
      if (!company?.id || !selectedProduct || !selectedDistributionProduct) {
        throw new Error("No distribution product selected");
      }
      return runDistributionProductUpdate(
        company.id,
        selectedProduct.id,
        selectedDistributionProduct.id,
        mapDistributionProductFormToPayload(values),
      );
    },
    onSuccess: async (distributionProduct) => {
      setDistributionFeedback({
        successMessage: `Distribution product ${distributionProduct.external_sku} updated.`,
        errorMessage: null,
      });
      setSelectedDistributionProduct(distributionProduct);
      await invalidateSelectedProductQueries(distributionProduct.product_id);
    },
    onError: (error) => {
      setDistributionFeedback({ successMessage: null, errorMessage: parseApiError(error) });
    },
  });

  const updateSerialManagementMutation = useMutation({
    mutationFn: (values: ProductSerialManagementFormValues) => {
      if (!company?.id || !selectedProduct) {
        throw new Error("No product selected");
      }
      return runProductSerialManagementUpdate(company.id, selectedProduct.id, values);
    },
    onSuccess: async (serialManagement) => {
      setSerialFeedback({ successMessage: `Serial management for ${selectedProduct?.sku ?? "product"} updated.`, errorMessage: null });
      await invalidateSelectedProductQueries(serialManagement.product_id);
    },
    onError: (error) => {
      setSerialFeedback({ successMessage: null, errorMessage: parseApiError(error) });
    },
  });

  const createPackagingMutation = useMutation({
    mutationFn: (values: ProductPackagingFormValues) => {
      if (!company?.id || !selectedProduct) {
        throw new Error("No product selected");
      }
      return runProductPackagingCreate(company.id, selectedProduct.id, mapProductPackagingFormToPayload(values));
    },
    onSuccess: async (packaging) => {
      setPackagingFeedback({ successMessage: `Packaging ${packaging.package_code} saved.`, errorMessage: null });
      setSelectedPackaging(packaging);
      await invalidateSelectedProductQueries(packaging.product_id);
    },
    onError: (error) => {
      setPackagingFeedback({ successMessage: null, errorMessage: parseApiError(error) });
    },
  });

  const updatePackagingMutation = useMutation({
    mutationFn: (values: ProductPackagingFormValues) => {
      if (!company?.id || !selectedProduct || !selectedPackaging) {
        throw new Error("No packaging selected");
      }
      return runProductPackagingUpdate(
        company.id,
        selectedProduct.id,
        selectedPackaging.id,
        mapProductPackagingFormToPayload(values),
      );
    },
    onSuccess: async (packaging) => {
      setPackagingFeedback({ successMessage: `Packaging ${packaging.package_code} updated.`, errorMessage: null });
      setSelectedPackaging(packaging);
      await invalidateSelectedProductQueries(packaging.product_id);
    },
    onError: (error) => {
      setPackagingFeedback({ successMessage: null, errorMessage: parseApiError(error) });
    },
  });

  const createProductMarkMutation = useMutation({
    mutationFn: (values: ProductMarkFormValues) => {
      if (!company?.id || !selectedProduct) {
        throw new Error("No product selected");
      }
      return runProductMarkCreate(company.id, selectedProduct.id, values);
    },
    onSuccess: async (productMark) => {
      setMarkFeedback({ successMessage: `Product mark ${productMark.value} saved.`, errorMessage: null });
      setSelectedProductMark(productMark);
      await invalidateSelectedProductQueries(productMark.product_id);
    },
    onError: (error) => {
      setMarkFeedback({ successMessage: null, errorMessage: parseApiError(error) });
    },
  });

  const updateProductMarkMutation = useMutation({
    mutationFn: (values: ProductMarkFormValues) => {
      if (!company?.id || !selectedProduct || !selectedProductMark) {
        throw new Error("No product mark selected");
      }
      return runProductMarkUpdate(company.id, selectedProduct.id, selectedProductMark.id, values);
    },
    onSuccess: async (productMark) => {
      setMarkFeedback({ successMessage: `Product mark ${productMark.value} updated.`, errorMessage: null });
      setSelectedProductMark(productMark);
      await invalidateSelectedProductQueries(productMark.product_id);
    },
    onError: (error) => {
      setMarkFeedback({ successMessage: null, errorMessage: parseApiError(error) });
    },
  });

  return {
    company,
    selectedProduct,
    setSelectedProduct,
    selectedDistributionProduct,
    setSelectedDistributionProduct,
    selectedPackaging,
    setSelectedPackaging,
    selectedProductMark,
    setSelectedProductMark,
    clearProductSelection: () => {
      setSelectedProduct(null);
      setProductFeedback(emptyFeedback());
    },
    clearDistributionSelection: () => {
      setSelectedDistributionProduct(null);
      setDistributionFeedback(emptyFeedback());
    },
    clearPackagingSelection: () => {
      setSelectedPackaging(null);
      setPackagingFeedback(emptyFeedback());
    },
    clearProductMarkSelection: () => {
      setSelectedProductMark(null);
      setMarkFeedback(emptyFeedback());
    },
    productView,
    productsQuery,
    pagedProducts,
    filteredProductCount: filteredProducts.length,
    customerAccounts: customerAccountsQuery.data ?? [],
    customerAccountsQuery,
    distributionProducts: distributionProductsQuery.data ?? [],
    distributionProductsQuery,
    serialManagement: serialManagementQuery.data ?? null,
    serialManagementQuery,
    packagingOptions: packagingQuery.data ?? [],
    packagingQuery,
    productMarks: productMarksQuery.data ?? [],
    productMarksQuery,
    productDefaultValues,
    distributionDefaultValues,
    serialDefaultValues,
    packagingDefaultValues,
    productMarkDefaultValues,
    productFeedback,
    distributionFeedback,
    serialFeedback,
    packagingFeedback,
    markFeedback,
    createProductMutation,
    updateProductMutation,
    createDistributionProductMutation,
    updateDistributionProductMutation,
    updateSerialManagementMutation,
    createPackagingMutation,
    updatePackagingMutation,
    createProductMarkMutation,
    updateProductMarkMutation,
    summary: {
      totalProducts: allProducts.length,
      activeProducts: allProducts.filter((product) => product.is_active).length,
      selectedDistributionCount: distributionProductsQuery.data?.length ?? 0,
      selectedPackagingCount: packagingQuery.data?.length ?? 0,
      selectedMarkCount: productMarksQuery.data?.length ?? 0,
      selectedSerialMode: serialManagementQuery.data?.tracking_mode ?? "NONE",
    },
  };
}
