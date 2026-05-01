import { z } from "zod";

export type PasswordState = { error?: string; success?: string };

export type EmailState = {
  error?: string;
  success?: string;
  values?: { new_email?: string };
};

export const passwordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(200, "Password must be 200 characters or fewer"),
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    path: ["confirm_password"],
    message: "Passwords do not match",
  });

export const emailSchema = z.object({
  new_email: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .max(254, "Email is too long"),
});
