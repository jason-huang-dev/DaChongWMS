import {
  clearPendingMfaChallenge,
  clearStoredSession,
  savePendingMfaChallenge,
  saveStoredSession,
} from "@/shared/storage/auth-storage";
import type { AuthSession, PendingMfaChallenge } from "@/shared/types/domain";

import { bootstrapRequest, fetchOperatorProfile, loginRequest, signupRequest, switchMembershipRequest } from "@/features/auth/model/api";
import { mapOperatorToSession } from "@/features/auth/model/mappers";
import type {
  AuthenticatedResult,
  BaseAuthSession,
  BootstrapPayload,
  SignupPayload,
} from "@/features/auth/model/types";
import { resolveAuthenticatedResponse, resolveLoginResult, verifyMfaChallengeAction } from "@/features/mfa/controller/actions";

export async function hydrateSession(baseSession: BaseAuthSession) {
  const operator = await fetchOperatorProfile({
    openid: baseSession.openid,
    operatorId: baseSession.operatorId,
  });
  return mapOperatorToSession(baseSession, operator);
}

export async function runLogin(username: string, password: string) {
  const response = await loginRequest({ name: username, password });
  return resolveLoginResult(response.data);
}

export async function runBootstrap(payload: BootstrapPayload = {}) {
  const response = await bootstrapRequest(payload);
  return hydrateSession({
    username: response.data.name,
    openid: response.data.openid,
    token: response.data.token,
    operatorId: response.data.user_id,
    companyId: response.data.company_id,
    companyName: response.data.company_name,
    membershipId: response.data.membership_id,
  });
}

export async function runSignup(payload: SignupPayload) {
  const response = await signupRequest(payload);
  return resolveAuthenticatedResponse(response.data);
}

export async function runMembershipSwitch(membershipId: number) {
  const data = await switchMembershipRequest(membershipId);
  return hydrateSession({
    username: data.name,
    openid: data.openid,
    token: data.token,
    operatorId: data.user_id,
    companyId: data.company_id,
    companyName: data.company_name,
    membershipId: data.membership_id,
  });
}

export async function runMfaChallengeVerification(challenge: PendingMfaChallenge, code: string): Promise<AuthenticatedResult> {
  return verifyMfaChallengeAction({ challenge_id: challenge.challengeId, code });
}

export function persistSession(session: AuthSession) {
  saveStoredSession(session);
}

export function clearSession() {
  clearStoredSession();
}

export function persistPendingChallenge(challenge: PendingMfaChallenge) {
  savePendingMfaChallenge(challenge);
}

export function clearPendingChallengeStorage() {
  clearPendingMfaChallenge();
}
