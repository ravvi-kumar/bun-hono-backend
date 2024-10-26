import { Context } from "hono";
import { and, eq } from "drizzle-orm";
import { db } from "~/db";
import { todos } from "~/db/schema";
import { ErrorResponse, SuccessResponse } from "~/utils/response.type";
import { todoCreateValidation, todoUpdateValidation } from "~/validations/todo";

export async function createTodo(c: Context) {
  const user = c.get("user");

  const parsedBody = await todoCreateValidation.safeParseAsync(
    await c.req.json()
  );
  if (!parsedBody.success) {
    return c.json<ErrorResponse>({
      success: false,
      error: parsedBody.error,
      isZodError: true,
    });
  }
  const { title, description } = parsedBody.data;

  const [todo] = await db
    .insert(todos)
    .values({
      title,
      description,
      userId: user.userId,
    })
    .returning();

  return c.json<SuccessResponse<typeof todo>>(
    {
      data: todo,
      message: "Todo created successfully",
      success: true,
    },
    201
  );
}

export async function getTodos(c: Context) {
  const user = c.get("user");
  const userTodos = await db
    .select()
    .from(todos)
    .where(eq(todos.userId, user.userId));
  return c.json<SuccessResponse<typeof userTodos>>({
    data: userTodos,
    message: "Todos fetched successfully",
    success: true,
  });
}

export async function updateTodo(c: Context) {
  const user = c.get("user");
  const { id } = c.req.param();
  const parsedBody = await todoUpdateValidation.safeParseAsync(
    await c.req.json()
  );
  if (!parsedBody.success) {
    return c.json<ErrorResponse>({
      success: false,
      error: parsedBody.error,
      isZodError: true,
    });
  }

  const [todo] = await db
    .update(todos)
    .set({ ...parsedBody.data })
    .where(and(eq(todos.id, id), eq(todos.userId, user.userId)))
    .returning();

  if (!todo) {
    return c.json<ErrorResponse>(
      { success: false, error: "Todo not found" },
      404
    );
  }

  return c.json<SuccessResponse<typeof todo>>({
    data: todo,
    message: "Todo updated successfully",
    success: true,
  });
}

export async function deleteTodo(c: Context) {
  const user = c.get("user");
  const { id } = c.req.param();

  const [todo] = await db
    .delete(todos)
    .where(and(eq(todos.id, id), eq(todos.userId, user.userId)))
    .returning();

  if (!todo) {
    return c.json<ErrorResponse>(
      { success: false, error: "Todo not found" },
      404
    );
  }

  return c.json<SuccessResponse>({
    message: "Todo deleted successfully",
    success: true,
  });
}
