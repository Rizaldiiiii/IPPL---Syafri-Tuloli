import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../app.js';
import { prisma } from '../db.js';

export const app: Express = createApp();

/** Mengosongkan seluruh tabel agar setiap test berdiri sendiri. */
export async function resetDatabase(): Promise<void> {
  await prisma.assignment.deleteMany();
  await prisma.dependency.deleteMany();
  await prisma.task.deleteMany();
  await prisma.holiday.deleteMany();
  await prisma.resource.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();
}

export function auth(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

export interface TestUser {
  token: string;
  userId: string;
  email: string;
}

export async function registerUser(
  email: string,
  name = 'Pengguna Uji',
  password = 'Password123',
): Promise<TestUser> {
  const response = await request(app).post('/api/auth/register').send({ name, email, password });
  return { token: response.body.token as string, userId: response.body.user.id as string, email };
}

export async function createProject(
  token: string,
  overrides: Record<string, unknown> = {},
): Promise<Record<string, any>> {
  const response = await request(app)
    .post('/api/projects')
    .set(auth(token))
    .send({
      name: 'Proyek Uji',
      description: 'Proyek untuk pengujian',
      startDate: '2026-10-19',
      weekendDays: [0, 6],
      ...overrides,
    });
  return response.body.project;
}

export async function createTask(
  token: string,
  projectId: string,
  overrides: Record<string, unknown> = {},
): Promise<{ task: Record<string, any>; tasks: Record<string, any>[]; status: number }> {
  const response = await request(app)
    .post(`/api/projects/${projectId}/tasks`)
    .set(auth(token))
    .send({
      name: 'Tugas',
      durationDays: 1,
      startDate: '2026-10-19',
      priority: 'MEDIUM',
      color: '#2563EB',
      progress: 0,
      ...overrides,
    });
  return { task: response.body.task, tasks: response.body.tasks ?? [], status: response.status };
}

export async function createDependency(
  token: string,
  successorId: string,
  body: Record<string, unknown>,
): Promise<request.Response> {
  return request(app).post(`/api/tasks/${successorId}/dependencies`).set(auth(token)).send(body);
}

export async function createResource(
  token: string,
  projectId: string,
  overrides: Record<string, unknown> = {},
): Promise<Record<string, any>> {
  const response = await request(app)
    .post(`/api/projects/${projectId}/resources`)
    .set(auth(token))
    .send({
      name: 'Andi Pratama',
      email: 'andi@example.com',
      role: 'Project Manager',
      salary: 15_000_000,
      ...overrides,
    });
  return response.body.resource;
}

export function taskByName(tasks: Record<string, any>[], name: string): Record<string, any> {
  const found = tasks.find((task) => task.name === name);
  if (!found) throw new Error(`Tugas dengan nama ${name} tidak ditemukan`);
  return found;
}
