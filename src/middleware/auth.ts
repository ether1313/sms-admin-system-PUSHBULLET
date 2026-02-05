import { Request, Response, NextFunction } from 'express';

export interface AuthRequest extends Request {}

/**
 * Require auth. adminId is set from session or restored from signed cookie by global middleware.
 */
export const requireAuth = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.session?.adminId) {
    res.redirect('/auth/login');
    return;
  }
  next();
};
