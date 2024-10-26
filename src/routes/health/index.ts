import { Hono } from "hono";
import { db } from "~/db";
import { SuccessResponse } from "~/utils/response.type";

const app = new Hono();
const apiRoutes = app
  .get("/", async (c) => {
    return c.json<SuccessResponse>({
      message: "Hello Hono.js!",
      success: true,
    });
  })
  .get("/db", async (c) => {
    const result = await db.execute("select 1");
    return c.json<SuccessResponse<typeof result>>({
      data: result,
      message: "Database is up and running",
      success: true,
    });
  });

export default apiRoutes;
