import { ZodError } from "zod";

export type SuccessResponse<T = void> = {
  success: true;
  message: string;
} & (T extends void ? {} : { data: T });

export type ErrorResponse = {
  success: false;
  error: string | ZodError;
  isFormError?: boolean;
  isZodError?: boolean;
};
