import { apiGet, apiPost } from "@/lib/http";
import type { FbMessage } from "@/shared/types/api";
import type { AuthSession, StaffRecord } from "@/shared/types/domain";
import type {
  AuthenticatedResponseData,
  BootstrapPayload,
  BootstrapResponseData,
  LoginPayload,
  LoginResponseData,
  SignupPayload,
  SignupResponseData,
} from "./types";

export async function loginRequest(payload: LoginPayload) {
  return apiPost<FbMessage<LoginResponseData>>("/api/login/", payload, null, true);
}

export async function bootstrapRequest(payload: BootstrapPayload = {}) {
  return apiPost<FbMessage<BootstrapResponseData>>("/api/test-system/register/", payload, null, true);
}

export async function signupRequest(payload: SignupPayload) {
  return apiPost<FbMessage<SignupResponseData>>("/api/signup/", payload, null, true);
}

export async function switchMembershipRequest(membershipId: number) {
  return apiPost<AuthenticatedResponseData>(`/api/access/my-memberships/${membershipId}/activate/`, {});
}

export async function fetchOperatorProfile(session: Pick<AuthSession, "openid" | "operatorId">) {
  return apiGet<StaffRecord>(`/api/staff/${session.operatorId}/`, undefined, {
    username: "",
    openid: session.openid,
    operatorId: session.operatorId,
    operatorName: "",
    operatorRole: "",
  });
}
