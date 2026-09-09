import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodTypeAny, z } from 'zod';

// Validates and replaces req.body with the parsed result. A ZodError is turned
// into a 400 by the centralized error handler.
export function validateBody<T extends ZodTypeAny>(schema: T): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.body = schema.parse(req.body) as z.infer<T>;
    next();
  };
}
