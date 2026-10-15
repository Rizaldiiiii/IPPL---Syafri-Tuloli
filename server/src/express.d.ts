/**
 * Menambahkan identitas pengguna yang sudah diverifikasi ke objek Request.
 * Nilai ini hanya diisi oleh middleware `requireAuth`.
 */

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export {};
