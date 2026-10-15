import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Meneruskan error dari handler async ke middleware error Express. */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
