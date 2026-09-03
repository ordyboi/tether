import type {
  FastifySchemaCompiler,
  FastifySerializerCompiler,
  FastifyTypeProvider,
} from "fastify";
import type { ZodType, z } from "zod";

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

export const zodSerializerCompiler: FastifySerializerCompiler<ZodType> =
  ({ schema }) =>
  (data) =>
    JSON.stringify(schema.parse(data));
