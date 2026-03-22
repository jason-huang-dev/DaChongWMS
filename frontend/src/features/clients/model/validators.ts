import { z } from "zod";

function optionalEmailField(label: string) {
  const emailSchema = z.string().email();
  return z
    .string()
    .trim()
    .refine((value) => value.length === 0 || emailSchema.safeParse(value).success, `${label} must be a valid email`)
    .default("");
}

export const clientAccountFormSchema = z.object({
  name: z.string().trim().min(1, "Client name is required"),
  code: z.string().trim().min(1, "Client code is required"),
  contact_name: z.string().trim().default(""),
  contact_email: optionalEmailField("Contact email"),
  contact_phone: z.string().trim().max(64, "Contact phone must be 64 characters or less").default(""),
  billing_email: optionalEmailField("Billing email"),
  shipping_method: z.string().trim().max(100, "Shipping method must be 100 characters or less").default(""),
  allow_dropshipping_orders: z.boolean().default(true),
  allow_inbound_goods: z.boolean().default(true),
  notes: z.string().trim().max(1000, "Notes must be 1000 characters or less").default(""),
  is_active: z.boolean().default(true),
});

export type ClientAccountFormSchema = z.infer<typeof clientAccountFormSchema>;
