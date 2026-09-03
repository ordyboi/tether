import type {
  FastifySchemaCompiler,
  FastifySerializerCompiler,
  FastifyTypeProvider,
} from "fastify";
import type { ZodError, ZodType, z } from "zod";

export interface ZodTypeProvider extends FastifyTypeProvider {
  validator: this["schema"] extends ZodType ? z.output<this["schema"]> : unknown;
  serializer: this["schema"] extends ZodType ? z.input<this["schema"]> : unknown;
}

export const zodValidatorCompiler: FastifySchemaCompiler<ZodType> =
  ({ schema }) =>
  (data) => {
    const result = schema.safeParse(data);
    return result.success ? { value: result.data } : { error: result.error };
  };

// Distinct from a request ZodError: this means the handler's own return value is malformed.
export class ResponseSerializationError extends Error {
  readonly cause: ZodError;

  constructor(cause: ZodError) {
    super("response failed to match its declared schema");
    this.cause = cause;
  }
}

export const zodSerializerCompiler: FastifySerializerCompiler<ZodType> =
  ({ schema }) =>
  (data) => {
    const result = schema.safeParse(data);
    if (!result.success) {
      throw new ResponseSerializationError(result.error);
    }
    return JSON.stringify(result.data);
  };
