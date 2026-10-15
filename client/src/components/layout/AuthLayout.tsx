import type { ReactNode } from 'react';
import { BarChart3, CalendarCheck2, GanttChartSquare, Route, Users } from 'lucide-react';

const HIGHLIGHTS = [
  { icon: GanttChartSquare, title: 'Gantt interaktif', description: 'Drag, resize, dan panah dependensi FS/SS dengan jeda hari kerja.' },
  { icon: Route, title: 'Analisis jalur kritis', description: 'CPM dan diagram PERT dihitung dari jadwal yang tersimpan.' },
  { icon: CalendarCheck2, title: 'Kalender proyek', description: 'Akhir pekan dan hari libur khusus mengurangi durasi otomatis.' },
  { icon: Users, title: 'Tim dan biaya', description: 'Alokasi anggota, biaya rencana, dan peringatan over-alokasi.' },
];

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}): JSX.Element {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 p-10 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, rgba(255,255,255,.35) 0, transparent 45%), radial-gradient(circle at 80% 70%, rgba(255,255,255,.25) 0, transparent 40%)',
          }}
          aria-hidden
        />
        <div className="relative">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-white/15 backdrop-blur">
              <GanttChartSquare className="h-5 w-5" aria-hidden />
            </span>
            <span className="text-lg font-bold tracking-tight">GanttKu</span>
          </div>
          <h1 className="mt-10 max-w-md text-3xl font-bold leading-tight">
            Rencanakan proyek, lihat jalur kritisnya, dan jaga tim tetap seimbang.
          </h1>
          <p className="mt-3 max-w-md text-sm text-white/80">
            Aplikasi manajemen proyek berbasis Gantt Chart dengan perhitungan hari kerja yang akurat.
          </p>
        </div>

        <ul className="relative grid gap-4">
          {HIGHLIGHTS.map((item) => (
            <li key={item.title} className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white/15 backdrop-blur">
                <item.icon className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="text-xs text-white/75">{item.description}</p>
              </div>
            </li>
          ))}
        </ul>

        <p className="relative flex items-center gap-2 text-xs text-white/70">
          <BarChart3 className="h-3.5 w-3.5" aria-hidden />
          Data tersimpan di database melalui REST API, bukan di peramban.
        </p>
      </div>

      <div className="flex items-center justify-center bg-canvas p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-2 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-to-br from-brand-500 to-brand-700 text-white">
              <GanttChartSquare className="h-5 w-5" aria-hidden />
            </span>
            <span className="text-lg font-bold tracking-tight text-ink">GanttKu</span>
          </div>

          <h2 className="text-2xl font-bold text-ink">{title}</h2>
          <p className="mt-1 text-sm text-ink-3">{subtitle}</p>

          <div className="mt-6 rounded-lg border border-line bg-surface p-5 shadow-sm sm:p-6">{children}</div>

          <div className="mt-5 text-center">{footer}</div>
        </div>
      </div>
    </div>
  );
}
