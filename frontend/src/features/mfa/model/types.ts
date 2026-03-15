export interface MfaStatusResponse {
  has_verified_enrollment: boolean;
  enrollment_required: boolean;
  primary_enrollment: {
    id: number;
    label: string;
    method: string;
    is_verified: boolean;
    is_primary: boolean;
    verified_at: string | null;
    create_time: string;
  } | null;
  recovery_codes_remaining: number;
  verified_methods: string[];
}

export interface TotpEnrollmentSetupResponse {
  enrollment_id: number;
  label: string;
  method: string;
  secret: string;
  provisioning_uri: string;
  issuer: string;
  recovery_codes_remaining: number;
}

export interface TotpEnrollmentVerifyResponse {
  enrollment_id: number;
  verified: boolean;
  verified_at: string;
  recovery_codes: string[];
}

export interface TotpEnrollmentPayload {
  label?: string;
}

export interface TotpEnrollmentVerifyPayload {
  enrollment_id: number;
  code: string;
}

export interface MfaChallengeFormValues {
  code: string;
}

export interface TotpEnrollmentFormValues {
  label: string;
}

export interface TotpVerificationFormValues {
  code: string;
}
