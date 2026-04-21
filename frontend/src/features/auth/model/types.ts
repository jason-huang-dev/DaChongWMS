import type { AuthSession, PendingMfaChallenge } from "@/shared/types/domain";

export interface AuthenticatedResponseData {
  name: string;
  openid: string;
  token?: string;
  user_id: number;
  company_id?: number;
  company_name?: string;
  membership_id?: number;
  mfa_enrollment_required: boolean;
  mfa_verified?: boolean;
  mfa_method?: string;
}

export interface MfaChallengeResponseData {
  name: string;
  mfa_required: true;
  challenge_id: string;
  available_methods: string[];
  expires_at: string;
}

export type LoginResponseData = AuthenticatedResponseData | MfaChallengeResponseData;

export interface SignupResponseData extends AuthenticatedResponseData {
  email: string;
}

export interface ChallengeVerifyResponseData extends AuthenticatedResponseData {
  mfa_verified: true;
  mfa_method: string;
}

export interface BootstrapResponseData extends AuthenticatedResponseData {
  used_default_name: boolean;
  used_default_password: boolean;
  seed_summary: Record<string, number>;
}

export interface LoginPayload {
  name: string;
  password: string;
}

export interface SignupPayload {
  name: string;
  email: string;
  password1: string;
  password2: string;
}

export interface BootstrapPayload {
  name?: string;
  password1?: string;
  password2?: string;
}

export interface SocialAuthProviderRecord {
  id: string;
  label: string;
  login_url: string;
}

export interface SocialAuthProviderListResponse {
  count: number;
  results: SocialAuthProviderRecord[];
}

export interface LoginFormValues {
  name: string;
  password: string;
}

export interface SignupFormValues {
  name: string;
  email: string;
  password1: string;
  password2: string;
}

export interface AuthenticatedResult {
  kind: "authenticated";
  session: AuthSession;
  mfaEnrollmentRequired: boolean;
}

export interface ChallengeRequiredResult {
  kind: "mfa_challenge";
  challenge: PendingMfaChallenge;
}

export type LoginResult = AuthenticatedResult | ChallengeRequiredResult;
export type SignupResult = AuthenticatedResult;

export interface AuthContextValue {
  session: AuthSession | null;
  pendingChallenge: PendingMfaChallenge | null;
  status: "loading" | "authenticated" | "anonymous";
  login: (username: string, password: string) => Promise<LoginResult>;
  signup: (payload: SignupPayload) => Promise<SignupResult>;
  bootstrap: (payload?: BootstrapPayload) => Promise<AuthSession>;
  acceptExternalSession: (baseSession: BaseAuthSession) => Promise<AuthSession>;
  switchMembership: (membershipId: number) => Promise<AuthSession>;
  completeMfaChallenge: (code: string) => Promise<AuthenticatedResult>;
  clearPendingChallenge: () => void;
  logout: () => void;
}

export type BaseAuthSession = Omit<AuthSession, "operatorName" | "operatorRole">;
