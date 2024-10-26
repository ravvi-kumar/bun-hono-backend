import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { todos } from "~/db/schema";

export const todoCreateValidation = createInsertSchema(todos, {
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  completed: z.boolean().default(false),
}).omit({ id: true, userId: true });

export const todoUpdateValidation = createInsertSchema(todos, {
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  completed: z.boolean().default(false),
})
  .omit({ id: true, userId: true })
  .optional();
