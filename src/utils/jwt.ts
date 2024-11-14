import { sign, verify } from "hono/jwt";

const secret = process.env.JWT_SECRET!;

export async function generateToken(data: any) {
  return await sign(
    {
      data,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // Token expires in 24 hours
    },
    secret,
    "HS256"
  );
}

export async function verifyToken(token: string) {
  try {
    const decodedPayload = await verify(token, secret, "HS256");
    return decodedPayload;
  } catch (error) {
    return null;
  }
}
