import Grid from "@mui/material/Grid";
import { Alert, Stack } from "@mui/material";

import { useI18n } from "@/app/ui-preferences";
import { useProductsController } from "@/features/products/controller/useProductsController";
import { DistributionProductForm } from "@/features/products/view/DistributionProductForm";
import { DistributionProductTable } from "@/features/products/view/DistributionProductTable";
import { ProductForm } from "@/features/products/view/ProductForm";
import { ProductMarkForm } from "@/features/products/view/ProductMarkForm";
import { ProductMarkTable } from "@/features/products/view/ProductMarkTable";
import { ProductPackagingForm } from "@/features/products/view/ProductPackagingForm";
import { ProductPackagingTable } from "@/features/products/view/ProductPackagingTable";
import { ProductTable } from "@/features/products/view/ProductTable";
import { SerialManagementForm } from "@/features/products/view/SerialManagementForm";
import { PageHeader } from "@/shared/components/page-header";
import { SummaryCard } from "@/shared/components/summary-card";
import { parseApiError } from "@/shared/utils/parse-api-error";

export function ProductsPage() {
  const { t, translate, msg } = useI18n();
  const {
    company,
    clearDistributionSelection,
    clearPackagingSelection,
    clearProductMarkSelection,
    clearProductSelection,
    createDistributionProductMutation,
    createPackagingMutation,
    createProductMarkMutation,
    createProductMutation,
    customerAccounts,
    distributionDefaultValues,
    distributionFeedback,
    distributionProducts,
    distributionProductsQuery,
    filteredProductCount,
    packagingDefaultValues,
    packagingFeedback,
    packagingOptions,
    packagingQuery,
    productDefaultValues,
    productFeedback,
    productMarkDefaultValues,
    markFeedback,
    productMarks,
    productMarksQuery,
    productsQuery,
    pagedProducts,
    productView,
    selectedDistributionProduct,
    selectedPackaging,
    selectedProduct,
    selectedProductMark,
    serialDefaultValues,
    serialFeedback,
    serialManagement,
    serialManagementQuery,
    setSelectedDistributionProduct,
    setSelectedPackaging,
    setSelectedProduct,
    setSelectedProductMark,
    summary,
    updateDistributionProductMutation,
    updatePackagingMutation,
    updateProductMarkMutation,
    updateProductMutation,
    updateSerialManagementMutation,
  } = useProductsController();

  return (
    <Stack spacing={3}>
      <PageHeader
        description="Maintain product master data, client distribution mappings, serial controls, packaging, and product marks in one workspace."
        title="Product management"
      />
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <SummaryCard
            description="Current workspace scope for product operations."
            items={[
              { label: "Workspace", value: company?.label ?? t("No workspace selected") },
              { label: "Selected product", value: selectedProduct?.sku ?? t("None") },
            ]}
            title="Scope"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <SummaryCard
            description="Product master-data coverage in the current workspace."
            items={[
              { label: "All products", value: String(summary.totalProducts) },
              { label: "Active products", value: String(summary.activeProducts) },
            ]}
            title="Catalog"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <SummaryCard
            description="Selected product operational mappings."
            items={[
              { label: "Distribution products", value: String(summary.selectedDistributionCount) },
              { label: "Serial mode", value: summary.selectedSerialMode },
            ]}
            title="Distribution and serials"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <SummaryCard
            description="Selected product packaging and handling metadata."
            items={[
              { label: "Packaging specs", value: String(summary.selectedPackagingCount) },
              { label: "Product marks", value: String(summary.selectedMarkCount) },
            ]}
            title="Packaging and marks"
          />
        </Grid>
        {!company ? (
          <Grid size={{ xs: 12 }}>
            <Alert severity="info">{t("Select an active workspace membership before managing products.")}</Alert>
          </Grid>
        ) : null}
        <Grid size={{ xs: 12, xl: 4 }}>
          <ProductForm
            defaultValues={productDefaultValues}
            errorMessage={productFeedback.errorMessage}
            isEditing={Boolean(selectedProduct)}
            isSubmitting={createProductMutation.isPending || updateProductMutation.isPending}
            onCancelEdit={clearProductSelection}
            onSubmit={(values) => (selectedProduct ? updateProductMutation.mutateAsync(values) : createProductMutation.mutateAsync(values))}
            successMessage={productFeedback.successMessage}
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 8 }}>
          <ProductTable
            companyLabel={company?.label ?? null}
            dataView={productView}
            error={productsQuery.error ? parseApiError(productsQuery.error) : null}
            isLoading={productsQuery.isLoading}
            onEdit={setSelectedProduct}
            products={pagedProducts}
            total={filteredProductCount}
          />
        </Grid>
        {selectedProduct ? (
          <>
            <Grid size={{ xs: 12, xl: 4 }}>
              <DistributionProductForm
                customerAccounts={customerAccounts}
                defaultValues={distributionDefaultValues}
                errorMessage={distributionFeedback.errorMessage}
                isEditing={Boolean(selectedDistributionProduct)}
                isSubmitting={
                  createDistributionProductMutation.isPending || updateDistributionProductMutation.isPending
                }
                onCancelEdit={clearDistributionSelection}
                onSubmit={(values) =>
                  selectedDistributionProduct
                    ? updateDistributionProductMutation.mutateAsync(values)
                    : createDistributionProductMutation.mutateAsync(values)
                }
                successMessage={distributionFeedback.successMessage}
              />
            </Grid>
            <Grid size={{ xs: 12, xl: 8 }}>
              <DistributionProductTable
                distributionProducts={distributionProducts}
                error={distributionProductsQuery.error ? parseApiError(distributionProductsQuery.error) : null}
                isLoading={distributionProductsQuery.isLoading}
                onEdit={setSelectedDistributionProduct}
              />
            </Grid>
            <Grid size={{ xs: 12, xl: 4 }}>
              <SerialManagementForm
                defaultValues={serialDefaultValues}
                errorMessage={serialFeedback.errorMessage}
                isSubmitting={updateSerialManagementMutation.isPending}
                onSubmit={(values) => updateSerialManagementMutation.mutateAsync(values)}
                successMessage={serialFeedback.successMessage}
              />
            </Grid>
            <Grid size={{ xs: 12, xl: 8 }}>
              <SummaryCard
                description="Current serial handling posture for the selected product."
                items={[
                  { label: "Tracking mode", value: serialManagement?.tracking_mode ?? "NONE" },
                  { label: "Pattern", value: serialManagement?.serial_pattern || "--" },
                  {
                    label: "Inbound capture",
                    value: serialManagement?.capture_on_inbound ? t("Enabled") : t("Disabled"),
                  },
                  {
                    label: "Outbound capture",
                    value: serialManagement?.capture_on_outbound ? t("Enabled") : t("Disabled"),
                  },
                  {
                    label: "Returns capture",
                    value: serialManagement?.capture_on_returns ? t("Enabled") : t("Disabled"),
                  },
                  {
                    label: "Unique serials",
                    value: serialManagement?.requires_uniqueness ? t("Required") : t("Not required"),
                  },
                ]}
                title="Serial summary"
              />
              {serialManagementQuery.error ? (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {parseApiError(serialManagementQuery.error)}
                </Alert>
              ) : null}
            </Grid>
            <Grid size={{ xs: 12, xl: 4 }}>
              <ProductPackagingForm
                defaultValues={packagingDefaultValues}
                errorMessage={packagingFeedback.errorMessage}
                isEditing={Boolean(selectedPackaging)}
                isSubmitting={createPackagingMutation.isPending || updatePackagingMutation.isPending}
                onCancelEdit={clearPackagingSelection}
                onSubmit={(values) =>
                  selectedPackaging
                    ? updatePackagingMutation.mutateAsync(values)
                    : createPackagingMutation.mutateAsync(values)
                }
                successMessage={packagingFeedback.successMessage}
              />
            </Grid>
            <Grid size={{ xs: 12, xl: 8 }}>
              <ProductPackagingTable
                error={packagingQuery.error ? parseApiError(packagingQuery.error) : null}
                isLoading={packagingQuery.isLoading}
                onEdit={setSelectedPackaging}
                packagingOptions={packagingOptions}
              />
            </Grid>
            <Grid size={{ xs: 12, xl: 4 }}>
              <ProductMarkForm
                defaultValues={productMarkDefaultValues}
                errorMessage={markFeedback.errorMessage}
                isEditing={Boolean(selectedProductMark)}
                isSubmitting={createProductMarkMutation.isPending || updateProductMarkMutation.isPending}
                onCancelEdit={clearProductMarkSelection}
                onSubmit={(values) =>
                  selectedProductMark
                    ? updateProductMarkMutation.mutateAsync(values)
                    : createProductMarkMutation.mutateAsync(values)
                }
                successMessage={markFeedback.successMessage}
              />
            </Grid>
            <Grid size={{ xs: 12, xl: 8 }}>
              <ProductMarkTable
                error={productMarksQuery.error ? parseApiError(productMarksQuery.error) : null}
                isLoading={productMarksQuery.isLoading}
                onEdit={setSelectedProductMark}
                productMarks={productMarks}
              />
            </Grid>
          </>
        ) : (
          <Grid size={{ xs: 12 }}>
            <Alert severity="info">
              {t(
                "Select a product from the table to manage distribution products, serial number handling, packaging, and product marks.",
              )}
            </Alert>
          </Grid>
        )}
      </Grid>
    </Stack>
  );
}
