import { AlertTriangle, CalendarRange, Coins, Flag, Route, TrendingUp, Users } from 'lucide-react';
import { formatISODateShort } from '@gantt/shared';
import { useAnalysis, useProject } from '../api/queries.js';
import { PageHeading } from '../components/layout/AppShell.js';
import { PertDiagram } from '../components/pert/PertDiagram.js';
import { Badge, Card, CardHeader, ProgressBar, StatTile } from '../components/ui/Card.js';
import { ErrorState, InlineAlert, LoadingBlock } from '../components/ui/Feedback.js';
import { formatDecimal, formatIDR } from '../lib/format.js';

export function AnalysisPage({ projectId }: { projectId: string }): JSX.Element {
  const projectQuery = useProject(projectId);
  const analysisQuery = useAnalysis(projectId);

  if (analysisQuery.isLoading || projectQuery.isLoading) {
    return <LoadingBlock label="Menghitung jalur kritis..." />;
  }

  if (analysisQuery.isError || !analysisQuery.data || !projectQuery.data) {
    return (
      <ErrorState
        description={
          analysisQuery.error instanceof Error
            ? analysisQuery.error.message
            : 'Analisis proyek tidak dapat dimuat.'
        }
        onRetry={() => void analysisQuery.refetch()}
      />
    );
  }

  const analysis = analysisQuery.data;
  const tasksById = new Map(projectQuery.data.tasks.map((task) => [task.id, task]));
  const totalScheduleDays = analysis.pert.nodes.length;

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <PageHeading
        title="Analisis proyek"
        description="Critical Path Method, diagram PERT, biaya, dan beban kerja dihitung dari jadwal yang tersimpan."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile
          label="Mulai proyek"
          value={formatISODateShort(analysis.summary.projectStart)}
          icon={<CalendarRange className="h-4 w-4" aria-hidden />}
          tone="brand"
        />
        <StatTile
          label="Selesai proyek"
          value={formatISODateShort(analysis.summary.projectFinish)}
          icon={<Flag className="h-4 w-4" aria-hidden />}
          tone="info"
        />
        <StatTile
          label="Total hari kerja"
          value={`${analysis.summary.totalWorkingDays} hari`}
          hint={`${totalScheduleDays} aktivitas daun`}
          icon={<TrendingUp className="h-4 w-4" aria-hidden />}
        />
        <StatTile
          label="Total biaya"
          value={formatIDR(analysis.summary.totalCost)}
          icon={<Coins className="h-4 w-4" aria-hidden />}
          tone="success"
        />
        <StatTile
          label="Tugas kritis"
          value={`${analysis.summary.criticalTaskCount} tugas`}
          icon={<Route className="h-4 w-4" aria-hidden />}
          tone="danger"
        />
      </div>

      <Card>
        <CardHeader
          title="Jalur kritis"
          description="Rangkaian tugas dengan total float nol. Keterlambatan pada salah satunya menunda tanggal selesai proyek."
          icon={<Route className="h-4 w-4" aria-hidden />}
        />
        <div className="flex flex-wrap items-center gap-2 px-5 py-4">
          {analysis.criticalPath.length === 0 ? (
            <p className="text-sm text-ink-3">Belum ada tugas kritis. Tambahkan tugas dan dependensi terlebih dahulu.</p>
          ) : (
            analysis.criticalPath.map((taskId, index) => (
              <span key={taskId} className="flex items-center gap-2">
                <span className="tabular flex h-6 w-6 items-center justify-center rounded-full bg-danger text-[11px] font-bold text-white">
                  {index + 1}
                </span>
                <span className="rounded-md border border-danger/25 bg-danger-bg px-2.5 py-1 text-xs font-semibold text-danger">
                  {tasksById.get(taskId)?.name ?? taskId}
                </span>
                {index < analysis.criticalPath.length - 1 ? (
                  <span className="text-ink-3" aria-hidden>
                    →
                  </span>
                ) : null}
              </span>
            ))
          )}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Diagram PERT"
          description="Jaringan activity-on-node. Kotak merah adalah aktivitas kritis."
          icon={<Route className="h-4 w-4" aria-hidden />}
        />
        <PertDiagram pert={analysis.pert} />
      </Card>

      <Card>
        <CardHeader
          title="Tabel CPM"
          description="ES/EF dari forward pass, LS/LF dari backward pass, float dalam satuan hari kerja."
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2/60 text-[11px] uppercase tracking-wide text-ink-3">
                <th scope="col" className="px-4 py-2.5 font-bold">Tugas</th>
                <th scope="col" className="px-3 py-2.5 text-right font-bold">Durasi</th>
                <th scope="col" className="px-3 py-2.5 text-right font-bold">ES</th>
                <th scope="col" className="px-3 py-2.5 text-right font-bold">EF</th>
                <th scope="col" className="px-3 py-2.5 text-right font-bold">LS</th>
                <th scope="col" className="px-3 py-2.5 text-right font-bold">LF</th>
                <th scope="col" className="px-3 py-2.5 text-right font-bold">Float</th>
                <th scope="col" className="px-4 py-2.5 font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {analysis.cpm.map((activity) => (
                <tr key={activity.id} className="border-b border-line/70 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-ink">{activity.name}</td>
                  <td className="tabular px-3 py-2.5 text-right text-ink-2">{activity.durationDays}</td>
                  <td className="tabular px-3 py-2.5 text-right text-ink-2">{activity.es}</td>
                  <td className="tabular px-3 py-2.5 text-right text-ink-2">{activity.ef}</td>
                  <td className="tabular px-3 py-2.5 text-right text-ink-2">{activity.ls}</td>
                  <td className="tabular px-3 py-2.5 text-right text-ink-2">{activity.lf}</td>
                  <td className="tabular px-3 py-2.5 text-right font-semibold text-ink">{activity.totalFloat}</td>
                  <td className="px-4 py-2.5">
                    {activity.critical ? (
                      <Badge tone="danger">Kritis</Badge>
                    ) : (
                      <Badge tone="neutral">Ada float</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Biaya dan beban kerja"
          description="Tarif harian = gaji bulanan / 22. Biaya dihitung dari durasi hari kerja dan persentase alokasi."
          icon={<Users className="h-4 w-4" aria-hidden />}
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2/60 text-[11px] uppercase tracking-wide text-ink-3">
                <th scope="col" className="px-4 py-2.5 font-bold">Anggota</th>
                <th scope="col" className="px-3 py-2.5 font-bold">Peran</th>
                <th scope="col" className="px-3 py-2.5 text-right font-bold">Gaji / bulan</th>
                <th scope="col" className="px-3 py-2.5 text-right font-bold">Beban (hari-orang)</th>
                <th scope="col" className="px-4 py-2.5 text-right font-bold">Biaya</th>
              </tr>
            </thead>
            <tbody>
              {analysis.costs.perResource.map((item) => (
                <tr key={item.resourceId} className="border-b border-line/70 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-ink">{item.resourceName}</td>
                  <td className="px-3 py-2.5 text-ink-2">{item.role}</td>
                  <td className="tabular px-3 py-2.5 text-right text-ink-2">{formatIDR(item.salary)}</td>
                  <td className="tabular px-3 py-2.5 text-right text-ink-2">{formatDecimal(item.plannedDays)}</td>
                  <td className="tabular px-4 py-2.5 text-right font-semibold text-ink">{formatIDR(item.cost)}</td>
                </tr>
              ))}
              <tr className="bg-surface-2/60">
                <td className="px-4 py-3 font-bold text-ink" colSpan={4}>
                  Total biaya proyek
                </td>
                <td className="tabular px-4 py-3 text-right font-bold text-ink">
                  {formatIDR(analysis.costs.totalCost)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {analysis.costs.overAllocations.length > 0 ? (
          <div className="border-t border-line p-5">
            <InlineAlert
              tone="warning"
              title={`Peringatan over-alokasi (${analysis.costs.overAllocations.length} hari)`}
            >
              <ul className="mt-1 flex flex-col gap-1">
                {analysis.costs.overAllocations.slice(0, 6).map((warning) => (
                  <li key={`${warning.resourceId}-${warning.date}`} className="flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span>
                      {warning.resourceName} · {formatISODateShort(warning.date)} · total{' '}
                      {warning.totalPercent}% pada {warning.taskIds.length} tugas
                    </span>
                  </li>
                ))}
              </ul>
            </InlineAlert>
          </div>
        ) : (
          <div className="border-t border-line px-5 py-4">
            <p className="text-xs text-ink-3">
              Tidak ada anggota yang beban alokasinya melebihi 100% pada hari kerja yang sama.
            </p>
          </div>
        )}
      </Card>

      {analysis.cpm.length > 0 ? (
        <Card>
          <CardHeader title="Ringkasan progres" description="Rata-rata progres berbobot durasi seluruh tugas daun." />
          <div className="px-5 py-4">
            <ProgressBar
              value={
                analysis.cpm.reduce((sum, activity) => sum + activity.durationDays, 0) === 0
                  ? 0
                  : projectQuery.data.tasks
                      .filter((task) => !task.isSummary)
                      .reduce((sum, task) => sum + task.progress * task.durationDays, 0) /
                    Math.max(
                      1,
                      projectQuery.data.tasks
                        .filter((task) => !task.isSummary)
                        .reduce((sum, task) => sum + task.durationDays, 0),
                    )
              }
              label="Progres proyek"
            />
          </div>
        </Card>
      ) : null}
    </div>
  );
}
