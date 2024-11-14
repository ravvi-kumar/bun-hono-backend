import { Context, Next } from "hono";
import { verifyToken } from "../utils/jwt";

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ message: "Unauthorized" }, 401);
  }

  const token = authHeader.split(" ")[1];
  const payload = await verifyToken(token);

  if (!payload) {
    return c.json({ message: "Invalid token" }, 401);
  }

  c.set("user", payload?.data);
  await next();
}
