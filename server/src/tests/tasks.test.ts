import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, auth, createProject, createTask, registerUser, resetDatabase, taskByName } from './helpers.js';

describe('tugas', () => {
  let token: string;
  let projectId: string;

  beforeEach(async () => {
    await resetDatabase();
    const user = await registerUser('tugas@example.com');
    token = user.token;
    const project = await createProject(token);
    projectId = project.id as string;
  });

  it('menambah, mengubah, dan menghapus tugas', async () => {
    const created = await createTask(token, projectId, { name: 'Kickoff', durationDays: 3 });
    expect(created.status).toBe(201);
    expect(created.task.durationDays).toBe(3);

    const patched = await request(app)
      .patch(`/api/tasks/${created.task.id}`)
      .set(auth(token))
      .send({ name: 'Kickoff proyek', durationDays: 4, progress: 50 });

    expect(patched.status).toBe(200);
    expect(patched.body.task.name).toBe('Kickoff proyek');
    expect(patched.body.task.durationDays).toBe(4);
    expect(patched.body.tasks).toHaveLength(1);

    const removed = await request(app).delete(`/api/tasks/${created.task.id}`).set(auth(token));
    expect(removed.status).toBe(200);
    expect(removed.body.tasks).toHaveLength(0);
  });

  it('menyimpan durasi, tanggal mulai, prioritas, dan warna', async () => {
    const created = await createTask(token, projectId, {
      name: 'Desain',
      durationDays: 5,
      startDate: '2026-10-21',
      priority: 'HIGH',
      color: '#7C3AED',
    });

    expect(created.task.priority).toBe('HIGH');
    expect(created.task.color).toBe('#7C3AED');
    expect(created.task.startDate).toBe('2026-10-21');
    expect(created.task.scheduledStart).toBe('2026-10-21');
  });

  it('menolak warna yang bukan heksadesimal', async () => {
    const response = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set(auth(token))
      .send({ name: 'Salah warna', durationDays: 1, startDate: '2026-10-19', color: 'biru' });

    expect(response.status).toBe(422);
  });

  it('membuat sub-tugas dan menghitung rentang serta progres induk', async () => {
    const parent = await createTask(token, projectId, { name: 'Perencanaan', durationDays: 1 });
    const childA = await createTask(token, projectId, {
      name: 'Kickoff',
      parentId: parent.task.id,
      durationDays: 3,
      progress: 100,
    });
    const childB = await createTask(token, projectId, {
      name: 'Spesifikasi',
      parentId: parent.task.id,
      durationDays: 4,
      progress: 50,
      startDate: '2026-10-23',
    });

    expect(childA.status).toBe(201);
    expect(childB.status).toBe(201);

    const snapshot = await request(app).get(`/api/projects/${projectId}`).set(auth(token));
    const summary = taskByName(snapshot.body.tasks, 'Perencanaan');

    expect(summary.isSummary).toBe(true);
    expect(summary.children).toHaveLength(2);
    expect(summary.scheduledStart).toBe('2026-10-19');
    expect(summary.scheduledEnd).toBe('2026-10-28');
    expect(summary.progress).toBe(71);
  });

  it('menolak perubahan durasi pada tugas induk', async () => {
    const parent = await createTask(token, projectId, { name: 'Induk', durationDays: 1 });
    await createTask(token, projectId, { name: 'Anak', parentId: parent.task.id, durationDays: 2 });

    const response = await request(app)
      .patch(`/api/tasks/${parent.task.id}`)
      .set(auth(token))
      .send({ durationDays: 10 });

    expect(response.status).toBe(422);
    expect(response.body.error.message).toMatch(/Tugas induk/);
  });

  it('menolak memberi anak pada tugas yang sudah punya dependensi', async () => {
    const first = await createTask(token, projectId, { name: 'A', durationDays: 2 });
    const second = await createTask(token, projectId, { name: 'B', durationDays: 2 });
    await request(app)
      .post(`/api/tasks/${second.task.id}/dependencies`)
      .set(auth(token))
      .send({ predecessorId: first.task.id, type: 'FS', lagDays: 0 });

    const response = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set(auth(token))
      .send({ name: 'Anak', parentId: first.task.id, durationDays: 1, startDate: '2026-10-19' });

    expect(response.status).toBe(409);
    expect(response.body.error.message).toMatch(/tidak dapat dijadikan tugas induk/);
  });

  it('menolak sub-tugas lebih dari tiga level', async () => {
    const level1 = await createTask(token, projectId, { name: 'Level 1' });
    const level2 = await createTask(token, projectId, { name: 'Level 2', parentId: level1.task.id });
    const level3 = await createTask(token, projectId, { name: 'Level 3', parentId: level2.task.id });
    expect(level3.status).toBe(201);

    const response = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set(auth(token))
      .send({ name: 'Level 4', parentId: level3.task.id, durationDays: 1, startDate: '2026-10-19' });

    expect(response.status).toBe(422);
    expect(response.body.error.message).toMatch(/maksimal 3 level/);
  });

  it('memindahkan tugas ke induk lain lewat /tasks/:id/move', async () => {
    const group = await createTask(token, projectId, { name: 'Grup' });
    const standalone = await createTask(token, projectId, { name: 'Mandiri', durationDays: 2 });

    const moved = await request(app)
      .post(`/api/tasks/${standalone.task.id}/move`)
      .set(auth(token))
      .send({ parentId: group.task.id, position: 0 });

    expect(moved.status).toBe(200);
    const snapshot = await request(app).get(`/api/projects/${projectId}`).set(auth(token));
    const child = taskByName(snapshot.body.tasks, 'Mandiri');
    expect(child.parentId).toBe(group.task.id);
    expect(taskByName(snapshot.body.tasks, 'Grup').isSummary).toBe(true);
  });

  it('menghapus tugas beserta anak dan dependensinya', async () => {
    const parent = await createTask(token, projectId, { name: 'Induk' });
    const child = await createTask(token, projectId, { name: 'Anak', parentId: parent.task.id });
    const other = await createTask(token, projectId, { name: 'Lain', durationDays: 2 });
    await request(app)
      .post(`/api/tasks/${other.task.id}/dependencies`)
      .set(auth(token))
      .send({ predecessorId: child.task.id, type: 'FS', lagDays: 0 });

    const removed = await request(app).delete(`/api/tasks/${parent.task.id}`).set(auth(token));
    expect(removed.status).toBe(200);
    expect(removed.body.tasks).toHaveLength(1);
    expect(removed.body.tasks[0].name).toBe('Lain');
  });

  it('mengembalikan 404 untuk tugas yang tidak ada', async () => {
    const response = await request(app).patch('/api/tasks/tidak-ada').set(auth(token)).send({ name: 'X' });
    expect(response.status).toBe(404);
  });
});
