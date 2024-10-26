import { Hono } from "hono";
import * as authController from "./auth.controller";

const app = new Hono();

const apiRoutes = app
  .post("/signup", authController.signup)
  .post("/login", authController.login)
  .get("/verify-email", authController.verifyEmail)
  .post("/forgot-password", authController.forgotPassword)
  .post("/reset-password", authController.resetPassword);

export default apiRoutes;
