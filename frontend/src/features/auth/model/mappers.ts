import type { PendingMfaChallenge, StaffRecord } from "@/shared/types/domain";

import type { BaseAuthSession, MfaChallengeResponseData } from "./types";

export function mapOperatorToSession(baseSession: BaseAuthSession, operator: StaffRecord) {
  return {
    ...baseSession,
    operatorName: operator.staff_name,
    operatorRole: operator.staff_type,
    permissionCodes: operator.permission_codes ?? [],
  };
}

export function mapMfaChallenge(data: MfaChallengeResponseData): PendingMfaChallenge {
  return {
    username: data.name,
    challengeId: data.challenge_id,
    expiresAt: data.expires_at,
    availableMethods: data.available_methods,
  };
}
