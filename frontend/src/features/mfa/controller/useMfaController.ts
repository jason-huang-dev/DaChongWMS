import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createTotpEnrollmentAction,
  fetchMfaStatusAction,
  verifyTotpEnrollmentAction,
} from "@/features/mfa/controller/actions";

export function useMfaController() {
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: ["mfa", "status"],
    queryFn: fetchMfaStatusAction,
  });

  const createEnrollmentMutation = useMutation({
    mutationFn: createTotpEnrollmentAction,
  });

  const verifyEnrollmentMutation = useMutation({
    mutationFn: verifyTotpEnrollmentAction,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["mfa", "status"] });
    },
  });

  return {
    createEnrollmentMutation,
    statusQuery,
    verifyEnrollmentMutation,
  };
}
