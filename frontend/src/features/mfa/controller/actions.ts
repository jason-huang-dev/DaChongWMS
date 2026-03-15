import { mapMfaChallenge, mapOperatorToSession } from "@/features/auth/model/mappers";
import type {
  AuthenticatedResponseData,
  AuthenticatedResult,
  ChallengeRequiredResult,
  LoginResponseData,
  MfaChallengeResponseData,
} from "@/features/auth/model/types";
import { fetchOperatorProfile } from "@/features/auth/model/api";
import { createTotpEnrollment, fetchMfaStatus, verifyMfaChallenge, verifyTotpEnrollment } from "@/features/mfa/model/api";
import type { MfaStatusResponse, TotpEnrollmentPayload, TotpEnrollmentVerifyPayload } from "@/features/mfa/model/types";

function isMfaChallengeResponse(data: LoginResponseData): data is MfaChallengeResponseData {
  return "mfa_required" in data && data.mfa_required === true;
}

async function hydrateAuthSuccess(data: AuthenticatedResponseData): Promise<AuthenticatedResult> {
  const operator = await fetchOperatorProfile({
    openid: data.openid,
    operatorId: data.user_id,
  });

  return {
    kind: "authenticated",
    mfaEnrollmentRequired: data.mfa_enrollment_required,
    session: mapOperatorToSession(
      {
        username: data.name,
        openid: data.openid,
        operatorId: data.user_id,
      },
      operator,
    ),
  };
}

export async function resolveLoginResult(data: LoginResponseData): Promise<AuthenticatedResult | ChallengeRequiredResult> {
  if (isMfaChallengeResponse(data)) {
    return {
      kind: "mfa_challenge",
      challenge: mapMfaChallenge(data),
    };
  }
  return hydrateAuthSuccess(data);
}

export async function resolveAuthenticatedResponse(data: AuthenticatedResponseData) {
  return hydrateAuthSuccess(data);
}

export function fetchMfaStatusAction(): Promise<MfaStatusResponse> {
  return fetchMfaStatus();
}

export function createTotpEnrollmentAction(payload: TotpEnrollmentPayload = {}) {
  return createTotpEnrollment(payload);
}

export function verifyTotpEnrollmentAction(payload: TotpEnrollmentVerifyPayload) {
  return verifyTotpEnrollment(payload);
}

export async function verifyMfaChallengeAction(payload: { challenge_id: string; code: string }) {
  const response = await verifyMfaChallenge(payload);
  return hydrateAuthSuccess(response.data);
}
