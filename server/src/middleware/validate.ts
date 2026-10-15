import type { RequestHandler } from 'express';
import type { ZodTypeAny, z } from 'zod';

/** Memvalidasi `req.body` dengan skema zod dan mengganti nilainya dengan hasil parse. */
export function validateBody<S extends ZodTypeAny>(schema: S): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(result.error);
      return;
    }
    req.body = result.data as z.infer<S>;
    next();
  };
}
