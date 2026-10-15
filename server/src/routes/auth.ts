import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { loginSchema, registerSchema } from '@gantt/shared';
import { prisma } from '../db.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { ApiError, unauthorized } from '../lib/errors.js';
import { currentUserId } from '../lib/ownership.js';
import { serializeUser } from '../lib/serializers.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

const BCRYPT_ROUNDS = 10;

/** Membatasi percobaan login/register sebelum pekerjaan verifikasi yang mahal. */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  handler: (_req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Terlalu banyak percobaan. Coba lagi dalam beberapa menit.',
      },
    });
  },
});

export const authRouter = Router();

authRouter.post(
  '/register',
  authLimiter,
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body as { name: string; email: string; password: string };

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ApiError(409, 'EMAIL_TAKEN', 'Email tersebut sudah terdaftar. Silakan login.');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await prisma.user.create({ data: { name, email, passwordHash } });
    const token = signToken(user.id);
    res.status(201).json({ token, user: serializeUser(user) });
  }),
);

authRouter.post(
  '/login',
  authLimiter,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as { email: string; password: string };
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email atau password salah.');

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email atau password salah.');

    const token = signToken(user.id);
    res.json({ token, user: serializeUser(user) });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: currentUserId(req) } });
    if (!user) throw unauthorized('Akun tidak ditemukan. Silakan login kembali.');
    res.json({ user: serializeUser(user) });
  }),
);
