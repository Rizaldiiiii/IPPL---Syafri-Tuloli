import type { AnalysisDTO } from '@gantt/shared';
import {
  buildPertGraph,
  computeCosts,
  computeCpm,
  createCalendar,
  workingDaysBetween,
} from '@gantt/shared';
import { getProjectSnapshot } from './snapshot.js';

/** Menggabungkan CPM, jalur kritis, data PERT, biaya, dan beban resource. */
export async function getProjectAnalysis(projectId: string): Promise<AnalysisDTO> {
  const snapshot = await getProjectSnapshot(projectId);
  const calendar = createCalendar(
    snapshot.project.weekendDays,
    snapshot.holidays.map((holiday) => holiday.date),
  );

  const cpm = computeCpm({
    projectStartDate: snapshot.project.startDate,
    tasks: snapshot.tasks,
    dependencies: snapshot.dependencies,
    calendar,
  });

  const pert = buildPertGraph({
    tasks: snapshot.tasks,
    dependencies: snapshot.dependencies,
    cpm: cpm.activities,
    criticalPath: cpm.criticalPath,
  });

  const costs = computeCosts({
    calendar,
    tasks: snapshot.tasks,
    assignments: snapshot.assignments,
    resources: snapshot.resources,
  });

  return {
    summary: {
      projectStart: snapshot.project.startDate,
      projectFinish: cpm.projectFinish,
      totalWorkingDays: workingDaysBetween(calendar, snapshot.project.startDate, cpm.projectFinish),
      totalCost: costs.totalCost,
      criticalTaskCount: cpm.activities.filter((activity) => activity.critical).length,
    },
    cpm: cpm.activities,
    criticalPath: cpm.criticalPath,
    pert,
    costs,
  };
}
