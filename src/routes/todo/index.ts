import { Hono } from "hono";
import * as todoController from "./todo.controller";
import { authMiddleware } from "~/middleware/auth.middleware";

const app = new Hono();

const apiRoutes = app
  .use("*", authMiddleware)
  .post("/", todoController.createTodo)
  .get("/", todoController.getTodos)
  .put("/:id", todoController.updateTodo)
  .delete("/:id", todoController.deleteTodo);

export default apiRoutes;
