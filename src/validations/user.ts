import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "~/db/schema";

export const passwordValidation = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");

export const userSignUpValidation = createInsertSchema(users, {
  email: z.string().email("Invalid email address"),
  password: passwordValidation,
}).omit({ id: true });

export const userLoginValidation = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string(),
});
