import { useMemo, useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useTenantScope } from "@/app/scope-context";
import { runStaffCreate, runStaffUpdate } from "@/features/security/controller/actions";
import { securityApi } from "@/features/security/model/api";
import { defaultStaffFormValues, mapStaffRecordToFormValues } from "@/features/security/model/mappers";
import type { MfaStatusRecord, StaffFormValues, StaffRecord, StaffTypeRecord } from "@/features/security/model/types";
import { useAuth } from "@/features/auth/controller/useAuthController";
import { useDataView } from "@/shared/hooks/use-data-view";
import { usePaginatedResource } from "@/shared/hooks/use-paginated-resource";
import { useResource } from "@/shared/hooks/use-resource";
import { invalidateQueryGroups } from "@/shared/lib/query-invalidation";
import { parseApiError } from "@/shared/utils/parse-api-error";

export function useSecurityController() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const { company, activeWarehouse } = useTenantScope();
  const [selectedStaff, setSelectedStaff] = useState<StaffRecord | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const staffView = useDataView({
    viewKey: `security.staff.${company?.openid ?? "anonymous"}`,
    defaultFilters: {
      staff_name__icontains: "",
      staff_type: "",
    },
    pageSize: 12,
  });

  const staffQuery = usePaginatedResource<StaffRecord>(
    ["security", "staff"],
    securityApi.staff,
    staffView.page,
    staffView.pageSize,
    staffView.queryFilters,
  );

  const staffTypesQuery = usePaginatedResource<StaffTypeRecord>(
    ["security", "staff-types"],
    securityApi.staffTypes,
    1,
    100,
  );

  const mfaStatusQuery = useResource<MfaStatusRecord>(
    ["security", "mfa-status", session?.operatorId],
    securityApi.mfaStatus,
    undefined,
    { enabled: Boolean(session) },
  );

  const createMutation = useMutation({
    mutationFn: (values: StaffFormValues) => runStaffCreate(values),
    onSuccess: async (staff) => {
      setErrorMessage(null);
      setSuccessMessage(`Staff record ${staff.staff_name} created.`);
      setSelectedStaff(staff);
      await invalidateQueryGroups(queryClient, [["security"], ["auth"]]);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });

  const updateMutation = useMutation({
    mutationFn: (values: StaffFormValues) => {
      if (!selectedStaff) {
        throw new Error("No staff member selected");
      }
      return runStaffUpdate(selectedStaff.id, values);
    },
    onSuccess: async (staff) => {
      setErrorMessage(null);
      setSuccessMessage(`Staff record ${staff.staff_name} updated.`);
      setSelectedStaff(staff);
      await invalidateQueryGroups(queryClient, [["security"], ["auth"]]);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });

  const roleOptions = useMemo(
    () =>
      (staffTypesQuery.data?.results ?? []).map((role) => ({
        label: role.staff_type,
        value: role.staff_type,
      })),
    [staffTypesQuery.data?.results],
  );

  return {
    company,
    activeWarehouse,
    selectedStaff,
    setSelectedStaff,
    defaultValues: selectedStaff ? mapStaffRecordToFormValues(selectedStaff) : defaultStaffFormValues,
    isEditing: Boolean(selectedStaff),
    createMutation,
    updateMutation,
    staffQuery,
    staffTypesQuery,
    roleOptions,
    mfaStatusQuery,
    staffView,
    successMessage,
    errorMessage,
    clearSelection: () => setSelectedStaff(null),
  };
}
