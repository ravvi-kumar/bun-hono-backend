import { Context } from "hono";
import { getSignedCookie, setSignedCookie } from "hono/cookie";
import { eq, and } from "drizzle-orm";
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

import { generateState, generateCodeVerifier, decodeIdToken, Google } from "arctic";

// Initialize Google OAuth client
const google = new Google(
  process.env.GOOGLE_CLIENT_ID!,
  process.env.GOOGLE_CLIENT_SECRET!,
  process.env.GOOGLE_REDIRECT_URI!
);

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

  if (!email || !password || !fullName) {
    return c.json<ErrorResponse>(
      { success: false, error: "All fields are required" },
      400
    );
  }

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

  if (!user || !user.password) {
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

  if (!user || !user.password) {
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

// OAuth
export async function oAuth(c: Context) {
  const provider = c.req.param("provider");

  if (provider !== "google") {
    return c.json<ErrorResponse>(
      { success: false, error: "Unsupported provider" },
      400
    );
  }

  const state = generateState();
  const codeVerifier = generateCodeVerifier();

  // Store these in session/cookie for validation during callback
  setSignedCookie(c, "oauth_state", state, process.env.COOKIE_SECRET!);
  setSignedCookie(c, "oauth_code_verifier", codeVerifier, process.env.COOKIE_SECRET!);

  const url = google.createAuthorizationURL(
    state,
    codeVerifier,
    ["openid", "profile", "email"],
  );
  url.searchParams.set("access_type", "offline");

  return c.redirect(String(url));

  // return c.json<SuccessResponse<{url : string}>>({
  //   success: true,
  //   data: { url: String(url) },
  //   message: "OAuth login successful",
  // });
}

export async function oAuthCallback(c: Context) {
  const provider = c.req.param("provider");
  const { code } = c.req.query();

  if (provider !== "google") {
    return c.json<ErrorResponse>(
      { success: false, error: "Unsupported provider" },
      400
    );
  }

  try {
    const storedCodeVerifier = await getSignedCookie(c, "oauth_code_verifier", process.env.COOKIE_SECRET!);
    if (!storedCodeVerifier) {
      return c.json<ErrorResponse>(
        { success: false, error: "Invalid code verifier" },
        400
      );
    }
    const tokens = await google.validateAuthorizationCode(code, storedCodeVerifier);

    const idToken = tokens.idToken();

    interface Claims {
      iss: string;
      azp: string;
      aud: string;
      sub: string;
      at_hash: string;
      hd: string;
      email: string;
      email_verified: string;
      iat: number;
      exp: number;
      nonce: string;
      name: string; //  will be provided when: The request scope included the string "profile"
    }

    const claims = decodeIdToken(idToken) as Claims;

    // First try to find user by OAuth provider and ID
    let [user] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.oAuthProvider, provider),
          eq(users.oAuthId, claims.sub)
        )
      )
      .limit(1);

    if (!user) {
      // If not found by OAuth, try to find by email
      [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, claims.email))
        .limit(1);

      if (user) {
        // If user exists with email but no OAuth, link the accounts
        await db
          .update(users)
          .set({
            oAuthProvider: provider,
            oAuthId: claims.sub,
            oAuthAccessToken: tokens.accessToken(),
            oAuthRefreshToken: tokens.hasRefreshToken() ? tokens.refreshToken() : null,
            oAuthTokenExpiresAt: tokens.accessTokenExpiresAt(),
            isVerified: true, // Mark as verified since OAuth email is verified
          })
          .where(eq(users.id, user.id));
      } else {
        // Create new user
        const [newUser] = await db
          .insert(users)
          .values({
            email: claims.email,
            fullName: claims.name,
            isVerified: true,
            oAuthProvider: provider,
            oAuthId: claims.sub,
            oAuthAccessToken: tokens.accessToken(),
            oAuthRefreshToken: tokens.hasRefreshToken() ? tokens.refreshToken() : null,
            oAuthTokenExpiresAt: tokens.accessTokenExpiresAt(),
          })
          .returning();
        user = newUser;
      }
    } else {
      // Update existing OAuth user's tokens
      await db
        .update(users)
        .set({
          oAuthAccessToken: tokens.accessToken(),
          oAuthRefreshToken: tokens.hasRefreshToken() ? tokens.refreshToken() : null,
          oAuthTokenExpiresAt: tokens.accessTokenExpiresAt(),
        })
        .where(eq(users.id, user.id));
    }

    // Generate JWT token
    const jwtToken = await generateToken({
      userId: user.id,
      email: user.email,
    });

    return c.json<SuccessResponse<{ token: string }>>({
      success: true,
      data: { token: jwtToken },
      message: "OAuth login successful",
    });

  } catch (error) {
    console.error("OAuth error:", error);
    return c.json<ErrorResponse>(
      { success: false, error: "Authentication failed" },
      401
    );
  }
}
