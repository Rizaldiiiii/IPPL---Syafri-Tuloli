import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, auth, registerUser, resetDatabase } from './helpers.js';

describe('autentikasi', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('mendaftarkan pengguna baru dan mengembalikan token', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Aldi', email: 'aldi@example.com', password: 'Password123' });

    expect(response.status).toBe(201);
    expect(response.body.token).toBeTruthy();
    expect(response.body.user.email).toBe('aldi@example.com');
    expect(response.body.user.passwordHash).toBeUndefined();
  });

  it('menolak password kurang dari 8 karakter', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Aldi', email: 'aldi@example.com', password: 'pendek' });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('menolak email yang sudah terdaftar', async () => {
    await registerUser('sama@example.com');
    const response = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Lain', email: 'sama@example.com', password: 'Password123' });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('login berhasil dan mengembalikan data pengguna', async () => {
    await registerUser('login@example.com', 'Nama Login');
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@example.com', password: 'Password123' });

    expect(response.status).toBe(200);
    expect(response.body.token).toBeTruthy();
    expect(response.body.user.name).toBe('Nama Login');
  });

  it('menolak password yang salah tanpa membocorkan penyebabnya', async () => {
    await registerUser('salah@example.com');
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'salah@example.com', password: 'PasswordSalah' });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(response.body.error.message).toMatch(/Email atau password salah/);
  });

  it('mengembalikan data user saat ini lewat GET /auth/me', async () => {
    const user = await registerUser('me@example.com');
    const response = await request(app).get('/api/auth/me').set(auth(user.token));

    expect(response.status).toBe(200);
    expect(response.body.user.id).toBe(user.userId);
  });

  it('menolak akses tanpa token', async () => {
    const response = await request(app).get('/api/auth/me');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('menolak token yang tidak valid', async () => {
    const response = await request(app).get('/api/auth/me').set(auth('token-palsu'));
    expect(response.status).toBe(401);
  });

  it('mengembalikan status sehat pada /api/health tanpa token', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });
});
