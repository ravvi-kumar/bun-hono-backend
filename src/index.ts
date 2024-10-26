// src/index.ts
import { Hono } from "hono";
import { logger } from "hono/logger";
import { HTTPException } from "hono/http-exception";
import { cors } from "hono/cors";
import { prettyJSON } from "hono/pretty-json";
import { showRoutes } from "hono/dev";
import { swaggerUI } from "@hono/swagger-ui";
import healthRoute from "./routes/health";
import authRoutes from "./routes/auth";
import { ErrorResponse } from "./utils/response.type";
import { ZodError } from "zod";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use("*", cors());
app.use("*", prettyJSON());

const apiRoutes = app
  .basePath("/api")
  .route("/health", healthRoute)
  .route("/auth", authRoutes);

// Swagger documentation
// app.get(
//   "/swagger",
//   swaggerUI({
//     url: "/api/swagger.json",
//     basePath: "/",
//   })
// );

// Error handling
app.onError((err, c) => {
  if (err instanceof ZodError) {
    return c.json<ErrorResponse>({
      success: false,
      error: err.message,
      isZodError: true,
    });
  }
  if (err instanceof HTTPException) {
    const errResponse =
      err.res ??
      c.json<ErrorResponse>(
        {
          success: false,
          error: err.message,
          isFormError:
            err.cause && typeof err.cause === "object" && "form" in err.cause
              ? err.cause.form === true
              : false,
        },
        err.status
      );
    return errResponse;
  }

  return c.json<ErrorResponse>(
    {
      success: false,
      error:
        process.env.NODE_ENV === "production"
          ? "Interal Server Error"
          : err.stack ?? err.message,
    },
    500
  );
});

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      status: 404,
      message: "Not Found",
      path: c.req.path,
    },
    404
  );
});

// Show all registered routes in development
// if (process.env.NODE_ENV === "development") {
//   showRoutes(app);
// }

// Start server
const port = parseInt(process.env.PORT || "3000", 10);
console.log(`Server is running on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
