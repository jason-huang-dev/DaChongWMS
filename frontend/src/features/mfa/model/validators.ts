import { z } from "zod";

export const mfaChallengeSchema = z.object({
  code: z.string().min(1, "Verification code is required"),
});

export const totpEnrollmentSchema = z.object({
  label: z.string().min(1, "Label is required"),
});

export const totpVerificationSchema = z.object({
  code: z.string().min(6, "Enter the 6-digit code from your authenticator app"),
});
