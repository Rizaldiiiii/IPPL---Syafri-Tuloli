import { useState, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  GanttChartSquare,
  LogOut,
  Menu,
  Users,
  X,
} from 'lucide-react';
import { cn } from '../../lib/cn.js';
import { useAuth } from '../../hooks/useAuth.js';
import { Avatar } from '../ui/Card.js';

export interface ProjectTab {
  label: string;
  to: string;
  icon: ReactNode;
}

export const PROJECT_TABS: ProjectTab[] = [
  { label: 'Gantt', to: 'gantt', icon: <GanttChartSquare className="h-4 w-4" aria-hidden /> },
  { label: 'Tim', to: 'team', icon: <Users className="h-4 w-4" aria-hidden /> },
  { label: 'Kalender', to: 'calendar', icon: <CalendarDays className="h-4 w-4" aria-hidden /> },
  { label: 'Analisis', to: 'analysis', icon: <BarChart3 className="h-4 w-4" aria-hidden /> },
];

export function AppShell({
  projectId,
  projectName,
  breadcrumb,
  actions,
  children,
}: {
  projectId?: string;
  projectName?: string;
  breadcrumb?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}): JSX.Element {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = (): void => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center gap-3 px-4 sm:px-6">
          <Link to="/projects" className="flex items-center gap-2 rounded-sm py-1 pr-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-brand-500 to-brand-700 text-white">
              <GanttChartSquare className="h-4 w-4" aria-hidden />
            </span>
            <span className="text-sm font-bold tracking-tight text-ink">GanttKu</span>
          </Link>

          <div className="hidden min-w-0 flex-1 items-center gap-3 md:flex">
            {breadcrumb}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {actions}
            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              className="flex items-center gap-2 rounded-full border border-line p-1 pr-3 transition hover:bg-surface-2"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
            >
              <Avatar name={user?.name ?? 'Pengguna'} className="h-7 w-7" />
              <span className="hidden max-w-[140px] truncate text-xs font-semibold text-ink-2 sm:block">
                {user?.name ?? 'Pengguna'}
              </span>
              <ChevronDown className="h-4 w-4 text-ink-3" aria-hidden />
            </button>
          </div>
        </div>

        {menuOpen ? (
          <div className="absolute right-4 top-14 z-40 w-64 rounded-md border border-line bg-surface p-2 shadow-lg sm:right-6">
            <div className="border-b border-line px-3 py-2">
              <p className="truncate text-sm font-semibold text-ink">{user?.name}</p>
              <p className="truncate text-xs text-ink-3">{user?.email}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="mt-1 flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm font-medium text-ink-2 transition hover:bg-surface-2 hover:text-ink"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Keluar
            </button>
          </div>
        ) : null}

        {projectId ? (
          <nav
            className="mx-auto flex w-full max-w-[1600px] items-center gap-1 overflow-x-auto px-2 pb-1 sm:px-4 md:hidden"
            aria-label="Navigasi proyek"
          >
            {PROJECT_TABS.map((tab) => (
              <NavLink
                key={tab.to}
                to={`/projects/${projectId}/${tab.to}`}
                className={({ isActive }) =>
                  cn(
                    'flex shrink-0 items-center gap-1.5 rounded-sm px-3 py-2 text-xs font-semibold transition',
                    isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-2 hover:bg-surface-2',
                  )
                }
              >
                {tab.icon}
                {tab.label}
              </NavLink>
            ))}
          </nav>
        ) : null}
      </header>

      <div className="mx-auto flex w-full max-w-[1600px] min-h-0 flex-1 gap-0">
        {projectId ? (
          <aside className="hidden w-56 shrink-0 border-r border-line bg-surface px-3 py-4 md:block">
            <Link
              to="/projects"
              className="mb-3 flex items-center gap-2 rounded-sm px-2 py-1.5 text-xs font-semibold text-ink-3 transition hover:bg-surface-2 hover:text-ink"
            >
              ← Semua proyek
            </Link>
            <p className="truncate px-2 pb-3 text-sm font-bold text-ink" title={projectName}>
              {projectName}
            </p>
            <nav className="flex flex-col gap-1" aria-label="Navigasi proyek">
              {PROJECT_TABS.map((tab) => (
                <NavLink
                  key={tab.to}
                  to={`/projects/${projectId}/${tab.to}`}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2.5 rounded-sm px-3 py-2 text-sm font-medium transition',
                      isActive
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
                    )
                  }
                >
                  {tab.icon}
                  {tab.label}
                </NavLink>
              ))}
            </nav>
          </aside>
        ) : null}

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

export function PageHeading({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}): JSX.Element {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line bg-surface px-4 py-4 sm:px-6">
      <div className="min-w-0">
        <h1 className="text-lg font-bold text-ink sm:text-xl">{title}</h1>
        {description ? <p className="mt-0.5 max-w-2xl text-xs text-ink-3 sm:text-sm">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function CloseIcon(): JSX.Element {
  return <X className="h-4 w-4" aria-hidden />;
}

export function MenuIcon(): JSX.Element {
  return <Menu className="h-4 w-4" aria-hidden />;
}
