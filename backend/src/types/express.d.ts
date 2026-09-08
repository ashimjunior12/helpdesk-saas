import 'express';

declare global {
  namespace Express {
    interface Request {
      /** Correlation id assigned per request by the requestContext middleware. */
      id: string;
    }
  }
}

export {};
