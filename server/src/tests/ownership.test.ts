import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, auth, createProject, createResource, createTask, registerUser, resetDatabase } from './helpers.js';

describe('pemisahan data antar pengguna', () => {
  let ownerToken: string;
  let intruderToken: string;
  let projectId: string;
  let taskId: string;
  let resourceId: string;

  beforeEach(async () => {
    await resetDatabase();
    const owner = await registerUser('pemilik@example.com');
    const intruder = await registerUser('penyusup@example.com');
    ownerToken = owner.token;
    intruderToken = intruder.token;

    projectId = (await createProject(ownerToken, { name: 'Proyek Rahasia' })).id as string;
    taskId = (await createTask(ownerToken, projectId, { name: 'Tugas Rahasia', durationDays: 3 })).task.id as string;
    resourceId = (await createResource(ownerToken, projectId, { email: 'rahasia@example.com' })).id as string;
  });

  it('daftar proyek hanya berisi proyek milik pengguna', async () => {
    const ownerList = await request(app).get('/api/projects').set(auth(ownerToken));
    const intruderList = await request(app).get('/api/projects').set(auth(intruderToken));

    expect(ownerList.body.projects).toHaveLength(1);
    expect(intruderList.body.projects).toHaveLength(0);
  });

  it('detail proyek pengguna lain dijawab 404', async () => {
    const response = await request(app).get(`/api/projects/${projectId}`).set(auth(intruderToken));
    expect(response.status).toBe(404);
  });

  it('membaca dan mengubah tugas pengguna lain dijawab 404', async () => {
    const patched = await request(app)
      .patch(`/api/tasks/${taskId}`)
      .set(auth(intruderToken))
      .send({ name: 'Diretas' });
    expect(patched.status).toBe(404);

    const removed = await request(app).delete(`/api/tasks/${taskId}`).set(auth(intruderToken));
    expect(removed.status).toBe(404);
  });

  it('menambah tugas ke proyek pengguna lain dijawab 404', async () => {
    const response = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set(auth(intruderToken))
      .send({ name: 'Penyusup', durationDays: 1, startDate: '2026-10-19' });

    expect(response.status).toBe(404);
  });

  it('analisis, kalender, dan anggota tim pengguna lain dijawab 404', async () => {
    const analysis = await request(app).get(`/api/projects/${projectId}/analysis`).set(auth(intruderToken));
    const calendar = await request(app)
      .put(`/api/projects/${projectId}/calendar`)
      .set(auth(intruderToken))
      .send({ weekendDays: [0] });
    const resources = await request(app).get(`/api/projects/${projectId}/resources`).set(auth(intruderToken));
    const resource = await request(app)
      .patch(`/api/resources/${resourceId}`)
      .set(auth(intruderToken))
      .send({ role: 'Diretas' });
    const holiday = await request(app)
      .post(`/api/projects/${projectId}/holidays`)
      .set(auth(intruderToken))
      .send({ date: '2026-12-25', name: 'Diretas' });

    expect(analysis.status).toBe(404);
    expect(calendar.status).toBe(404);
    expect(resources.status).toBe(404);
    expect(resource.status).toBe(404);
    expect(holiday.status).toBe(404);
  });

  it('pemilik tetap dapat menghapus proyeknya', async () => {
    const removed = await request(app).delete(`/api/projects/${projectId}`).set(auth(ownerToken));
    expect(removed.status).toBe(204);

    const list = await request(app).get('/api/projects').set(auth(ownerToken));
    expect(list.body.projects).toHaveLength(0);
  });
});
