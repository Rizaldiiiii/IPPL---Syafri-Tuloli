import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import type { ApiErrorBody } from '@gantt/shared';
import { ApiError } from '../lib/errors.js';

export function notFoundHandler(_req: Request, res: Response): void {
  const body: ApiErrorBody = {
    error: { code: 'NOT_FOUND', message: 'Alamat yang diminta tidak tersedia.' },
  };
  res.status(404).json(body);
}

/** Mengubah semua jenis error menjadi bentuk `{ error: { code, message, details } }`. */
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof ApiError) {
    const body: ApiErrorBody = {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    };
    res.status(error.status).json(body);
    return;
  }

  if (error instanceof ZodError) {
    const body: ApiErrorBody = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Data yang dikirim tidak valid.',
        details: {
          issues: error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      },
    };
    res.status(422).json(body);
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      const body: ApiErrorBody = {
        error: { code: 'CONFLICT', message: 'Data dengan nilai unik tersebut sudah ada.' },
      };
      res.status(409).json(body);
      return;
    }
    if (error.code === 'P2025') {
      const body: ApiErrorBody = {
        error: { code: 'NOT_FOUND', message: 'Data tidak ditemukan.' },
      };
      res.status(404).json(body);
      return;
    }
  }

  // Detail teknis hanya masuk log server, tidak dikirim ke client.
  process.stderr.write(`[error] ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  const body: ApiErrorBody = {
    error: { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan pada server. Coba lagi beberapa saat lagi.' },
  };
  res.status(500).json(body);
}
