import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, auth, createProject, createTask, registerUser, resetDatabase, taskByName } from './helpers.js';

describe('kalender proyek', () => {
  let token: string;
  let projectId: string;

  beforeEach(async () => {
    await resetDatabase();
    const user = await registerUser('kalender@example.com');
    token = user.token;
    projectId = (await createProject(token)).id as string;
  });

  it('durasi tidak menghitung akhir pekan', async () => {
    const created = await createTask(token, projectId, {
      name: 'A',
      startDate: '2026-10-23',
      durationDays: 3,
    });
    expect(created.task.scheduledStart).toBe('2026-10-23');
    expect(created.task.scheduledEnd).toBe('2026-10-27');
    expect(created.task.durationDays).toBe(3);
  });

  it('hari libur menggeser jadwal', async () => {
    await createTask(token, projectId, { name: 'A', startDate: '2026-10-23', durationDays: 3 });

    const response = await request(app)
      .post(`/api/projects/${projectId}/holidays`)
      .set(auth(token))
      .send({ date: '2026-10-26', name: 'Libur internal' });

    expect(response.status).toBe(201);
    expect(taskByName(response.body.tasks, 'A').scheduledEnd).toBe('2026-10-28');
  });

  it('menolak hari libur duplikat pada tanggal yang sama', async () => {
    await request(app)
      .post(`/api/projects/${projectId}/holidays`)
      .set(auth(token))
      .send({ date: '2026-12-25', name: 'Natal' });

    const duplicate = await request(app)
      .post(`/api/projects/${projectId}/holidays`)
      .set(auth(token))
      .send({ date: '2026-12-25', name: 'Natal lagi' });

    expect(duplicate.status).toBe(409);
  });

  it('menghapus hari libur mengembalikan jadwal', async () => {
    await createTask(token, projectId, { name: 'A', startDate: '2026-10-23', durationDays: 3 });
    const holiday = await request(app)
      .post(`/api/projects/${projectId}/holidays`)
      .set(auth(token))
      .send({ date: '2026-10-26', name: 'Libur internal' });

    const removed = await request(app).delete(`/api/holidays/${holiday.body.holiday.id}`).set(auth(token));
    expect(removed.status).toBe(200);
    expect(taskByName(removed.body.tasks, 'A').scheduledEnd).toBe('2026-10-27');
  });

  it('mengubah akhir pekan menggeser jadwal', async () => {
    await createTask(token, projectId, { name: 'A', startDate: '2026-10-23', durationDays: 3 });

    const response = await request(app)
      .put(`/api/projects/${projectId}/calendar`)
      .set(auth(token))
      .send({ weekendDays: [5, 6] });

    expect(response.status).toBe(200);
    expect(response.body.project.weekendDays).toEqual([5, 6]);
    // Jumat 23 dan Sabtu 24 menjadi akhir pekan, sehingga tugas bergeser ke Minggu 25.
    expect(taskByName(response.body.tasks, 'A').scheduledStart).toBe('2026-10-25');
    expect(taskByName(response.body.tasks, 'A').scheduledEnd).toBe('2026-10-27');
  });

  it('menolak akhir pekan yang mencakup ketujuh hari', async () => {
    const response = await request(app)
      .put(`/api/projects/${projectId}/calendar`)
      .set(auth(token))
      .send({ weekendDays: [0, 1, 2, 3, 4, 5, 6] });

    expect(response.status).toBe(422);
  });

  it('menyimpan daftar hari libur pada snapshot proyek', async () => {
    await request(app)
      .post(`/api/projects/${projectId}/holidays`)
      .set(auth(token))
      .send({ date: '2026-11-11', name: 'Libur internal (contoh)' });

    const snapshot = await request(app).get(`/api/projects/${projectId}`).set(auth(token));
    expect(snapshot.body.holidays).toHaveLength(1);
    expect(snapshot.body.project.weekendDays).toEqual([0, 6]);
  });
});
