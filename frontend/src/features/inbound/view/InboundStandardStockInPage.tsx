import { useState } from "react";

import { Button, Stack } from "@mui/material";

import { useI18n } from "@/app/ui-preferences";
import { isActivePurchaseOrderStatus } from "@/features/inbound/model/purchase-order-metrics";
import { CreateReceiptPanel } from "@/features/inbound/view/components/CreateReceiptPanel";
import {
  DockExceptionsSection,
  ScanToListSection,
  ScanToReceiveSection,
  ScanToSignSection,
  StockInListManagementSection,
  standardStockInTabItems,
  type StandardStockInTabValue,
} from "@/features/inbound/view/inbound-workspace-sections";
import { useInboundWorkspaceController } from "@/features/inbound/view/useInboundWorkspaceController";
import { useInboundWorkspaceTab } from "@/features/inbound/view/useInboundWorkspaceTab";
import { PageTabs } from "@/shared/components/page-tabs";
import { WorkbenchPageTemplate } from "@/shared/components/workbench-page-template";

const standardStockInTabValues = standardStockInTabItems.map((item) => item.value);

export function InboundStandardStockInPage() {
  const { translate } = useI18n();
  const { setValue, value } = useInboundWorkspaceTab<StandardStockInTabValue>(
    standardStockInTabValues,
    "stock-in-list-management",
  );
  const controller = useInboundWorkspaceController();
  const [isCreateReceiptOpen, setIsCreateReceiptOpen] = useState(false);
  const [isExceptionsOpen, setIsExceptionsOpen] = useState(false);
  const overdueRows = (controller.overduePurchaseOrdersQuery.data?.results ?? []).filter((row) => isActivePurchaseOrderStatus(row.status));
  const canShowDockExceptions =
    overdueRows.length > 0 || controller.overduePurchaseOrdersQuery.isLoading || Boolean(controller.overduePurchaseOrdersQuery.error);

  return (
    <WorkbenchPageTemplate
      navigation={
        <PageTabs
          ariaLabel="Standard stock-in pages"
          items={standardStockInTabItems.map((item) => ({ ...item, label: translate(item.label) }))}
          onChange={setValue}
          value={value}
        />
      }
    >
      <Stack spacing={2} sx={{ height: "100%", minHeight: 0 }}>
        {value === "stock-in-list-management" ? (
          <Stack spacing={2} sx={{ flex: "1 1 auto", minHeight: 0 }}>
            {isCreateReceiptOpen ? (
              <CreateReceiptPanel
                errorMessage={controller.receiptErrorMessage}
                isPending={controller.createReceiptMutation.isPending}
                onSubmit={(values) => controller.createReceiptMutation.mutateAsync(values)}
                showHeader={false}
                successMessage={controller.receiptSuccessMessage}
              />
            ) : null}
            {isExceptionsOpen ? <DockExceptionsSection controller={controller} /> : null}
            <StockInListManagementSection
              controller={controller}
              toolbarActions={
                <Stack direction="row" spacing={1}>
                  <Button onClick={() => setIsCreateReceiptOpen((current) => !current)} size="small" variant={isCreateReceiptOpen ? "contained" : "outlined"}>
                    {translate("Create receipt")}
                  </Button>
                  {canShowDockExceptions ? (
                    <Button
                      onClick={() => setIsExceptionsOpen((current) => !current)}
                      size="small"
                      variant={isExceptionsOpen ? "contained" : "outlined"}
                    >
                      {translate("Dock exceptions")}
                    </Button>
                  ) : null}
                </Stack>
              }
            />
          </Stack>
        ) : null}
        {value === "scan-to-sign" ? <ScanToSignSection /> : null}
        {value === "scan-to-receive" ? <ScanToReceiveSection /> : null}
        {value === "scan-to-list" ? <ScanToListSection /> : null}
      </Stack>
    </WorkbenchPageTemplate>
  );
}
