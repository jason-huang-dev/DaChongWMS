import { Box, Stack } from "@mui/material";

import { useI18n } from "@/app/ui-preferences";
import {
  ImportManagementSection,
  ImportToStockInSection,
  importTabItems,
  type ImportTabValue,
} from "@/features/inbound/view/inbound-workspace-sections";
import { useInboundWorkspaceController } from "@/features/inbound/view/useInboundWorkspaceController";
import { useInboundWorkspaceTab } from "@/features/inbound/view/useInboundWorkspaceTab";
import { PageTabs } from "@/shared/components/page-tabs";

const importTabValues = importTabItems.map((item) => item.value);

export function InboundImportsPage() {
  const { translate } = useI18n();
  const { setValue, value } = useInboundWorkspaceTab<ImportTabValue>(importTabValues, "import-to-stock-in");
  const controller = useInboundWorkspaceController();

  return (
    <Stack spacing={3}>
      <Box sx={{ borderBottom: 1, borderColor: "divider", pb: 1 }}>
        <PageTabs
          ariaLabel="Stock-in import pages"
          items={importTabItems.map((item) => ({ ...item, label: translate(item.label) }))}
          onChange={setValue}
          value={value}
        />
      </Box>
      {value === "import-to-stock-in" ? <ImportToStockInSection controller={controller} /> : null}
      {value === "import-management" ? <ImportManagementSection controller={controller} /> : null}
    </Stack>
  );
}
