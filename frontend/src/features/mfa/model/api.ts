import { apiGet, apiPost } from "@/lib/http";

import type {
  MfaStatusResponse,
  TotpEnrollmentPayload,
  TotpEnrollmentSetupResponse,
  TotpEnrollmentVerifyPayload,
  TotpEnrollmentVerifyResponse,
} from "./types";
import type { ChallengeVerifyResponseData } from "@/features/auth/model/types";
import type { FbMessage } from "@/shared/types/api";

export function fetchMfaStatus() {
  return apiGet<MfaStatusResponse>("/api/mfa/status/");
}

export function createTotpEnrollment(payload: TotpEnrollmentPayload = {}) {
  return apiPost<TotpEnrollmentSetupResponse>("/api/mfa/enrollments/totp/", payload);
}

export function verifyTotpEnrollment(payload: TotpEnrollmentVerifyPayload) {
  return apiPost<TotpEnrollmentVerifyResponse>("/api/mfa/enrollments/totp/verify/", payload);
}

export function verifyMfaChallenge(payload: { challenge_id: string; code: string }) {
  return apiPost<FbMessage<ChallengeVerifyResponseData>>("/api/mfa/challenges/verify/", payload, null, true);
}
