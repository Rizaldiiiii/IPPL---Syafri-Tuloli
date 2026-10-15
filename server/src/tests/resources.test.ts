import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, auth, createProject, createResource, createTask, registerUser, resetDatabase } from './helpers.js';

describe('tim dan alokasi', () => {
  let token: string;
  let projectId: string;

  beforeEach(async () => {
    await resetDatabase();
    const user = await registerUser('tim@example.com');
    token = user.token;
    projectId = (await createProject(token)).id as string;
  });

  it('menambah anggota tim dan mengalokasikannya ke tugas', async () => {
    const resource = await createResource(token, projectId, {
      name: 'Budi Santoso',
      email: 'budi@example.com',
      role: 'Backend Developer',
      salary: 12_000_000,
    });
    expect(resource.salary).toBe(12_000_000);

    const task = await createTask(token, projectId, { name: 'Implementasi', durationDays: 10 });
    const assignment = await request(app)
      .post(`/api/tasks/${task.task.id}/assignments`)
      .set(auth(token))
      .send({ resourceId: resource.id, allocationPercent: 50 });

    expect(assignment.status).toBe(201);
    expect(assignment.body.assignment.allocationPercent).toBe(50);

    const snapshot = await request(app).get(`/api/projects/${projectId}`).set(auth(token));
    expect(snapshot.body.assignments).toHaveLength(1);
    expect(snapshot.body.resources).toHaveLength(1);
  });

  it('mengubah dan menghapus anggota tim', async () => {
    const resource = await createResource(token, projectId);
    const updated = await request(app)
      .patch(`/api/resources/${resource.id}`)
      .set(auth(token))
      .send({ role: 'QA Engineer', salary: 9_000_000 });

    expect(updated.status).toBe(200);
    expect(updated.body.resource.role).toBe('QA Engineer');

    const removed = await request(app).delete(`/api/resources/${resource.id}`).set(auth(token));
    expect(removed.status).toBe(204);
  });

  it('menghapus anggota menghapus alokasinya', async () => {
    const resource = await createResource(token, projectId);
    const task = await createTask(token, projectId, { name: 'Tugas', durationDays: 3 });
    await request(app)
      .post(`/api/tasks/${task.task.id}/assignments`)
      .set(auth(token))
      .send({ resourceId: resource.id, allocationPercent: 100 });

    await request(app).delete(`/api/resources/${resource.id}`).set(auth(token));

    const snapshot = await request(app).get(`/api/projects/${projectId}`).set(auth(token));
    expect(snapshot.body.assignments).toHaveLength(0);
  });

  it('menolak alokasi ganda pada tugas yang sama', async () => {
    const resource = await createResource(token, projectId);
    const task = await createTask(token, projectId, { name: 'Tugas', durationDays: 3 });
    const body = { resourceId: resource.id, allocationPercent: 100 };

    await request(app).post(`/api/tasks/${task.task.id}/assignments`).set(auth(token)).send(body);
    const duplicate = await request(app)
      .post(`/api/tasks/${task.task.id}/assignments`)
      .set(auth(token))
      .send(body);

    expect(duplicate.status).toBe(409);
  });

  it('menolak alokasi pada tugas induk', async () => {
    const resource = await createResource(token, projectId);
    const parent = await createTask(token, projectId, { name: 'Induk' });
    await createTask(token, projectId, { name: 'Anak', parentId: parent.task.id });

    const response = await request(app)
      .post(`/api/tasks/${parent.task.id}/assignments`)
      .set(auth(token))
      .send({ resourceId: resource.id, allocationPercent: 100 });

    expect(response.status).toBe(422);
    expect(response.body.error.message).toMatch(/Tugas induk/);
  });

  it('menolak persentase alokasi di luar 1 sampai 100', async () => {
    const resource = await createResource(token, projectId);
    const task = await createTask(token, projectId, { name: 'Tugas', durationDays: 3 });

    const response = await request(app)
      .post(`/api/tasks/${task.task.id}/assignments`)
      .set(auth(token))
      .send({ resourceId: resource.id, allocationPercent: 150 });

    expect(response.status).toBe(422);
  });

  it('menolak alokasi ke anggota dari proyek lain', async () => {
    const otherUser = await registerUser('lain@example.com');
    const otherProject = await createProject(otherUser.token, { name: 'Proyek Lain' });
    const otherResource = await createResource(otherUser.token, otherProject.id, {
      email: 'lain-resource@example.com',
    });

    const task = await createTask(token, projectId, { name: 'Tugas', durationDays: 3 });
    const response = await request(app)
      .post(`/api/tasks/${task.task.id}/assignments`)
      .set(auth(token))
      .send({ resourceId: otherResource.id, allocationPercent: 100 });

    expect(response.status).toBe(404);
  });
});
