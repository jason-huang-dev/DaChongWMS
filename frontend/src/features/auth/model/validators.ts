import { z } from "zod";

export const loginSchema = z.object({
  name: z.string().min(1, "User name is required"),
  password: z.string().min(1, "Password is required"),
});

export const signupSchema = z
  .object({
    name: z.string().min(1, "User name is required"),
    email: z.string().email("Email is invalid"),
    password1: z.string().min(8, "Password must be at least 8 characters"),
    password2: z.string().min(1, "Please confirm your password"),
  })
  .refine((values) => values.password1 === values.password2, {
    message: "Passwords must match",
    path: ["password2"],
  });
