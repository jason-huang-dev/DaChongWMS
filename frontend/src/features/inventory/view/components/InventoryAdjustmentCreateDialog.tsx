import { Dialog, DialogContent, DialogTitle } from "@mui/material";

import type { InventoryAdjustmentValues } from "@/features/inventory/model/types";
import { InventoryAdjustmentForm } from "@/features/inventory/view/InventoryAdjustmentForm";
import type { ReferenceListState } from "@/shared/hooks/use-reference-options";
import type { InventoryBalanceRecord } from "@/shared/types/domain";

interface InventoryAdjustmentCreateDialogProps {
  errorMessage?: string | null;
  inventoryBalanceReference: ReferenceListState<number, InventoryBalanceRecord>;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: InventoryAdjustmentValues) => Promise<unknown> | unknown;
  open: boolean;
}

export function InventoryAdjustmentCreateDialog({
  errorMessage,
  inventoryBalanceReference,
  isSubmitting,
  onClose,
  onSubmit,
  open,
}: InventoryAdjustmentCreateDialogProps) {
  return (
    <Dialog fullWidth maxWidth="md" onClose={onClose} open={open}>
      <DialogTitle>Create inventory adjustment</DialogTitle>
      <DialogContent dividers>
        <InventoryAdjustmentForm
          errorMessage={errorMessage}
          inventoryBalanceReference={inventoryBalanceReference}
          isSubmitting={isSubmitting}
          onCancel={onClose}
          onSubmit={onSubmit}
          submitLabel="Create adjustment list"
        />
      </DialogContent>
    </Dialog>
  );
}
