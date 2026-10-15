import type { NextFunction, Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { unauthorized } from '../lib/errors.js';

export interface JwtPayload {
  sub: string;
}

/** Membuat token JWT untuk pengguna. */
export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  } as jwt.SignOptions);
}

/**
 * Memverifikasi header `Authorization: Bearer <token>` dan menaruh id pengguna
 * pada `req.userId`. Identitas selalu diambil dari token, bukan dari body request.
 */
export const requireAuth: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    next(unauthorized());
    return;
  }
  const token = header.slice('Bearer '.length).trim();
  try {
    const payload = jwt.verify(token, config.jwtSecret) as JwtPayload;
    if (!payload.sub) {
      next(unauthorized('Token tidak valid. Silakan login kembali.'));
      return;
    }
    req.userId = payload.sub;
    next();
  } catch {
    next(unauthorized('Sesi Anda sudah berakhir. Silakan login kembali.'));
  }
};
