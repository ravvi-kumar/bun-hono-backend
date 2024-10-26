import { Context } from "hono";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { generateToken } from "~/utils/jwt";
import { hashPassword, verifyPassword } from "~/utils/password";
import { sendVerificationEmail, sendPasswordResetEmail } from "~/utils/email";
import { db } from "~/db";
import { users } from "~/db/schema";
import { ErrorResponse, SuccessResponse } from "~/utils/response.type";
import {
  passwordValidation,
  userLoginValidation,
  userSignUpValidation,
} from "~/validations/user";

export async function signup(c: Context) {
  const parsedBody = await userSignUpValidation.safeParseAsync(
    await c.req.json()
  );
  if (!parsedBody.success) {
    return c.json<ErrorResponse>({
      error: parsedBody.error,
      success: false,
      isZodError: true,
    });
  }

  const { email, password, fullName } = parsedBody.data;

  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existingUser.length > 0) {
    return c.json<ErrorResponse>(
      { error: "Email already exists", success: false },
      400
    );
  }

  const hashedPassword = await hashPassword(password);
  const verificationToken = nanoid();

  await db.insert(users).values({
    email,
    password: hashedPassword,
    fullName,
    verificationToken,
  });

  await sendVerificationEmail(email, verificationToken);

  return c.json<SuccessResponse>({
    message: "User created successfully. Please verify your email.",
    success: true,
  });
}

export async function login(c: Context) {
  const parsedBody = await userLoginValidation.safeParseAsync(
    await c.req.json()
  );
  if (!parsedBody.success) {
    return c.json<ErrorResponse>({
      error: parsedBody.error,
      success: false,
      isZodError: true,
    });
  }
  const { email, password } = parsedBody.data;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!user) {
    return c.json<ErrorResponse>(
      { success: false, error: "Invalid credentials" },
      401
    );
  }

  const isValidPassword = await verifyPassword(password, user.password);
  if (!isValidPassword) {
    return c.json<ErrorResponse>(
      { success: false, error: "Invalid credentials" },
      401
    );
  }

  if (!user.isVerified) {
    return c.json<ErrorResponse>(
      { success: false, error: "Please verify your email first" },
      401
    );
  }

  const token = await generateToken({
    userId: user.id,
    email: user.email,
  });

  return c.json<SuccessResponse<{ token: string }>>({
    data: { token },
    success: true,
    message: "Token generated successfully",
  });
}

export async function verifyEmail(c: Context) {
  const { token } = c.req.query();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.verificationToken, token))
    .limit(1);
  if (!user) {
    return c.json<ErrorResponse>(
      { success: false, error: "Invalid verification token" },
      400
    );
  }

  await db
    .update(users)
    .set({ isVerified: true, verificationToken: null })
    .where(eq(users.id, user.id));

  return c.json<SuccessResponse>({
    message: "Email verified successfully",
    success: true,
  });
}

export async function forgotPassword(c: Context) {
  const { email } = await c.req.json();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!user) {
    return c.json<SuccessResponse>({
      message: "If the email exists, a reset link will be sent",
      success: true,
    });
  }

  const resetToken = nanoid();
  await db
    .update(users)
    .set({ resetPasswordToken: resetToken })
    .where(eq(users.id, user.id));

  await sendPasswordResetEmail(email, resetToken);

  return c.json<SuccessResponse>({
    message: "If the email exists, a reset link will be sent",
    success: true,
  });
}

export async function resetPassword(c: Context) {
  const { token, newPassword } = await c.req.json();
  const validatePassword = await passwordValidation.safeParseAsync(newPassword);
  if (!validatePassword.success) {
    return c.json<ErrorResponse>({
      success: false,
      error: validatePassword.error,
      isZodError: true,
    });
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.resetPasswordToken, token))
    .limit(1);
  if (!user) {
    return c.json<ErrorResponse>(
      { success: false, error: "Invalid reset token" },
      400
    );
  }

  const hashedPassword = await hashPassword(newPassword);
  await db
    .update(users)
    .set({ password: hashedPassword, resetPasswordToken: null })
    .where(eq(users.id, user.id));

  return c.json<SuccessResponse>({
    success: true,
    message: "Password reset successfully",
  });
}
