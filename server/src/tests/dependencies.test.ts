import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, auth, createProject, createTask, registerUser, resetDatabase, taskByName } from './helpers.js';

describe('dependensi dan penjadwalan', () => {
  let token: string;
  let projectId: string;

  beforeEach(async () => {
    await resetDatabase();
    const user = await registerUser('dependensi@example.com');
    token = user.token;
    projectId = (await createProject(token)).id as string;
  });

  it('menerapkan FS lag 0 sesuai vektor uji 6.11', async () => {
    const first = await createTask(token, projectId, {
      name: 'A',
      startDate: '2026-10-23',
      durationDays: 3,
    });
    const second = await createTask(token, projectId, { name: 'B', durationDays: 2 });

    const response = await request(app)
      .post(`/api/tasks/${second.task.id}/dependencies`)
      .set(auth(token))
      .send({ predecessorId: first.task.id, type: 'FS', lagDays: 0 });

    expect(response.status).toBe(201);
    const tasks = response.body.tasks as Record<string, any>[];
    expect(taskByName(tasks, 'A').scheduledEnd).toBe('2026-10-27');
    expect(taskByName(tasks, 'B').scheduledStart).toBe('2026-10-28');
  });

  it('menerapkan SS lag 2 sesuai vektor uji 6.11', async () => {
    const first = await createTask(token, projectId, { name: 'A', startDate: '2026-10-23', durationDays: 3 });
    const second = await createTask(token, projectId, { name: 'B', durationDays: 2 });

    const response = await request(app)
      .post(`/api/tasks/${second.task.id}/dependencies`)
      .set(auth(token))
      .send({ predecessorId: first.task.id, type: 'SS', lagDays: 2 });

    expect(response.status).toBe(201);
    expect(taskByName(response.body.tasks, 'B').scheduledStart).toBe('2026-10-27');
  });

  it('mengembalikan bar ke batas predecessor (startDate tidak memundurkan jadwal)', async () => {
    const first = await createTask(token, projectId, { name: 'A', durationDays: 5 });
    const second = await createTask(token, projectId, { name: 'B', durationDays: 2 });
    await request(app)
      .post(`/api/tasks/${second.task.id}/dependencies`)
      .set(auth(token))
      .send({ predecessorId: first.task.id, type: 'FS', lagDays: 0 });

    // Pengguna mencoba memindahkan B lebih awal dari batas predecessor.
    const patched = await request(app)
      .patch(`/api/tasks/${second.task.id}`)
      .set(auth(token))
      .send({ startDate: '2026-10-19' });

    expect(patched.status).toBe(200);
    const taskB = taskByName(patched.body.tasks, 'B');
    expect(taskB.startDate).toBe('2026-10-19');
    expect(taskB.scheduledStart).toBe('2026-10-26');
  });

  it('menolak dependensi ke diri sendiri', async () => {
    const task = await createTask(token, projectId, { name: 'A' });
    const response = await request(app)
      .post(`/api/tasks/${task.task.id}/dependencies`)
      .set(auth(token))
      .send({ predecessorId: task.task.id, type: 'FS', lagDays: 0 });

    expect(response.status).toBe(422);
    expect(response.body.error.message).toMatch(/dirinya sendiri/);
  });

  it('menolak pasangan dependensi duplikat', async () => {
    const first = await createTask(token, projectId, { name: 'A', durationDays: 2 });
    const second = await createTask(token, projectId, { name: 'B', durationDays: 2 });
    const body = { predecessorId: first.task.id, type: 'FS', lagDays: 0 };

    await request(app).post(`/api/tasks/${second.task.id}/dependencies`).set(auth(token)).send(body);
    const duplicate = await request(app)
      .post(`/api/tasks/${second.task.id}/dependencies`)
      .set(auth(token))
      .send(body);

    expect(duplicate.status).toBe(422);
    expect(duplicate.body.error.message).toMatch(/sudah ada/);
  });

  it('menolak dependensi yang membentuk siklus dengan kode CYCLE_DETECTED', async () => {
    const first = await createTask(token, projectId, { name: 'A', durationDays: 2 });
    const second = await createTask(token, projectId, { name: 'B', durationDays: 2 });
    const third = await createTask(token, projectId, { name: 'C', durationDays: 2 });

    await request(app)
      .post(`/api/tasks/${second.task.id}/dependencies`)
      .set(auth(token))
      .send({ predecessorId: first.task.id, type: 'FS', lagDays: 0 });
    await request(app)
      .post(`/api/tasks/${third.task.id}/dependencies`)
      .set(auth(token))
      .send({ predecessorId: second.task.id, type: 'FS', lagDays: 0 });

    const cycle = await request(app)
      .post(`/api/tasks/${first.task.id}/dependencies`)
      .set(auth(token))
      .send({ predecessorId: third.task.id, type: 'FS', lagDays: 0 });

    expect(cycle.status).toBe(422);
    expect(cycle.body.error.code).toBe('CYCLE_DETECTED');
  });

  it('menolak dependensi pada tugas induk', async () => {
    const parent = await createTask(token, projectId, { name: 'Induk' });
    const child = await createTask(token, projectId, { name: 'Anak', parentId: parent.task.id });
    const other = await createTask(token, projectId, { name: 'Lain', durationDays: 2 });

    const response = await request(app)
      .post(`/api/tasks/${other.task.id}/dependencies`)
      .set(auth(token))
      .send({ predecessorId: parent.task.id, type: 'FS', lagDays: 0 });

    expect(response.status).toBe(422);
    expect(response.body.error.message).toMatch(/tugas induk/);
    expect(child.status).toBe(201);
  });

  it('menolak jeda di luar rentang -365 sampai 365', async () => {
    const first = await createTask(token, projectId, { name: 'A', durationDays: 2 });
    const second = await createTask(token, projectId, { name: 'B', durationDays: 2 });

    const response = await request(app)
      .post(`/api/tasks/${second.task.id}/dependencies`)
      .set(auth(token))
      .send({ predecessorId: first.task.id, type: 'FS', lagDays: 400 });

    expect(response.status).toBe(422);
  });

  it('mengubah tipe dan jeda dependensi', async () => {
    const first = await createTask(token, projectId, { name: 'A', startDate: '2026-10-23', durationDays: 3 });
    const second = await createTask(token, projectId, { name: 'B', durationDays: 2 });
    const created = await request(app)
      .post(`/api/tasks/${second.task.id}/dependencies`)
      .set(auth(token))
      .send({ predecessorId: first.task.id, type: 'FS', lagDays: 0 });

    const updated = await request(app)
      .patch(`/api/dependencies/${created.body.dependency.id}`)
      .set(auth(token))
      .send({ type: 'SS', lagDays: 2 });

    expect(updated.status).toBe(200);
    expect(taskByName(updated.body.tasks, 'B').scheduledStart).toBe('2026-10-27');
  });

  it('menghapus dependensi dan mengembalikan jadwal', async () => {
    const first = await createTask(token, projectId, { name: 'A', durationDays: 5 });
    const second = await createTask(token, projectId, { name: 'B', durationDays: 2, startDate: '2026-10-19' });
    const created = await request(app)
      .post(`/api/tasks/${second.task.id}/dependencies`)
      .set(auth(token))
      .send({ predecessorId: first.task.id, type: 'FS', lagDays: 0 });

    const removed = await request(app)
      .delete(`/api/dependencies/${created.body.dependency.id}`)
      .set(auth(token));

    expect(removed.status).toBe(200);
    expect(taskByName(removed.body.tasks, 'B').scheduledStart).toBe('2026-10-19');
  });
});
