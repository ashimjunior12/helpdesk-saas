import 'express';

declare global {
  namespace Express {
    interface Request {
      /** Correlation id assigned per request by the requestContext middleware. */
      id: string;
      /** Authenticated user, set by the requireAuth middleware on protected routes. */
      user?: { id: string; email: string };
    }
  }
}

export {};
