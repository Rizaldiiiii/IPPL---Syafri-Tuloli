import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, auth, createProject, createResource, createTask, registerUser, resetDatabase } from './helpers.js';

describe('analisis proyek', () => {
  let token: string;
  let projectId: string;

  beforeEach(async () => {
    await resetDatabase();
    const user = await registerUser('analisis@example.com');
    token = user.token;
    projectId = (await createProject(token)).id as string;
  });

  /** Vektor uji 6.11: A(3) -> B(2), A -> C(5), B dan C -> D(1), semua FS lag 0. */
  async function buildCpmVector(): Promise<Record<string, string>> {
    const a = await createTask(token, projectId, { name: 'A', durationDays: 3 });
    const b = await createTask(token, projectId, { name: 'B', durationDays: 2 });
    const c = await createTask(token, projectId, { name: 'C', durationDays: 5 });
    const d = await createTask(token, projectId, { name: 'D', durationDays: 1 });

    const links: [string, string][] = [
      [a.task.id, b.task.id],
      [a.task.id, c.task.id],
      [b.task.id, d.task.id],
      [c.task.id, d.task.id],
    ];
    for (const [predecessorId, successorId] of links) {
      const response = await request(app)
        .post(`/api/tasks/${successorId}/dependencies`)
        .set(auth(token))
        .send({ predecessorId, type: 'FS', lagDays: 0 });
      expect(response.status).toBe(201);
    }

    return { a: a.task.id as string, b: b.task.id as string, c: c.task.id as string, d: d.task.id as string };
  }

  it('menghasilkan jalur kritis A -> C -> D dengan PE = 8', async () => {
    const ids = await buildCpmVector();
    const response = await request(app).get(`/api/projects/${projectId}/analysis`).set(auth(token));

    expect(response.status).toBe(200);
    expect(response.body.criticalPath).toEqual([ids.a, ids.c, ids.d]);
    expect(response.body.summary.criticalTaskCount).toBe(3);

    const activityB = response.body.cpm.find((activity: { id: string }) => activity.id === ids.b);
    expect(activityB.critical).toBe(false);
    expect(activityB.totalFloat).toBe(3);

    const activityD = response.body.cpm.find((activity: { id: string }) => activity.id === ids.d);
    expect(activityD.ef).toBe(8);
    expect(response.body.summary.projectFinish).toBe('2026-10-29');
  });

  it('menyertakan node dan panah kritis pada diagram PERT', async () => {
    const ids = await buildCpmVector();
    const response = await request(app).get(`/api/projects/${projectId}/analysis`).set(auth(token));

    const pert = response.body.pert;
    expect(pert.nodes).toHaveLength(4);
    const criticalIds = pert.nodes.filter((node: { critical: boolean }) => node.critical).map((node: { id: string }) => node.id);
    expect(criticalIds.sort()).toEqual([ids.a, ids.c, ids.d].sort());
    // Hanya tautan yang dilewati jalur kritis A -> C -> D yang ditandai kritis.
    const criticalEdges = pert.edges
      .filter((edge: { critical: boolean }) => edge.critical)
      .map((edge: { predecessorId: string; successorId: string }) => `${edge.predecessorId}->${edge.successorId}`)
      .sort();
    expect(criticalEdges).toEqual([`${ids.a}->${ids.c}`, `${ids.c}->${ids.d}`].sort());
  });

  it('menghitung biaya proyek dari durasi dan alokasi', async () => {
    const resource = await createResource(token, projectId, {
      name: 'Andi',
      email: 'andi.analisis@example.com',
      salary: 22_000_000,
    });
    const task = await createTask(token, projectId, { name: 'Tugas', durationDays: 10 });
    await request(app)
      .post(`/api/tasks/${task.task.id}/assignments`)
      .set(auth(token))
      .send({ resourceId: resource.id, allocationPercent: 50 });

    const response = await request(app).get(`/api/projects/${projectId}/analysis`).set(auth(token));

    // tarif harian = 22.000.000 / 22 = 1.000.000; 10 hari x 50% = 5.000.000
    expect(response.body.summary.totalCost).toBe(5_000_000);
    expect(response.body.costs.perResource[0].cost).toBe(5_000_000);
  });

  it('melaporkan peringatan over-alokasi', async () => {
    const resource = await createResource(token, projectId, { email: 'over@example.com' });
    const first = await createTask(token, projectId, { name: 'Tumpang 1', durationDays: 3 });
    const second = await createTask(token, projectId, { name: 'Tumpang 2', durationDays: 3 });

    for (const taskId of [first.task.id, second.task.id]) {
      await request(app)
        .post(`/api/tasks/${taskId}/assignments`)
        .set(auth(token))
        .send({ resourceId: resource.id, allocationPercent: 60 });
    }

    const response = await request(app).get(`/api/projects/${projectId}/analysis`).set(auth(token));
    expect(response.body.costs.overAllocations.length).toBe(3);
    expect(response.body.costs.overAllocations[0].totalPercent).toBe(120);
  });

  it('mengembalikan analisis kosong untuk proyek tanpa tugas', async () => {
    const response = await request(app).get(`/api/projects/${projectId}/analysis`).set(auth(token));
    expect(response.status).toBe(200);
    expect(response.body.criticalPath).toEqual([]);
    expect(response.body.cpm).toEqual([]);
    expect(response.body.summary.totalCost).toBe(0);
  });
});
