/**
 * Error API dengan kode dan status HTTP.
 * Semua pesan ditulis dalam bahasa Indonesia dan tidak membocorkan detail internal.
 */

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_TAKEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'CYCLE_DETECTED'
  | 'BUSINESS_RULE_VIOLATION'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(status: number, code: ApiErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    if (details) this.details = details;
  }
}

export const badRequest = (message: string, details?: Record<string, unknown>): ApiError =>
  new ApiError(422, 'VALIDATION_ERROR', message, details);

export const unauthorized = (message = 'Anda belum masuk. Silakan login terlebih dahulu.'): ApiError =>
  new ApiError(401, 'UNAUTHENTICATED', message);

export const notFound = (message = 'Data tidak ditemukan.'): ApiError =>
  new ApiError(404, 'NOT_FOUND', message);

export const conflict = (message: string, code: ApiErrorCode = 'CONFLICT'): ApiError =>
  new ApiError(409, code, message);
