import { Navigate, Outlet, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell.js';
import { LoadingBlock } from './components/ui/Feedback.js';
import { useAuth } from './hooks/useAuth.js';
import { useProject } from './api/queries.js';
import { AnalysisPage } from './pages/AnalysisPage.js';
import { CalendarPage } from './pages/CalendarPage.js';
import { GanttPage } from './pages/GanttPage.js';
import { LoginPage, RegisterPage } from './pages/LoginPage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';
import { ProjectsPage } from './pages/ProjectsPage.js';
import { TeamPage } from './pages/TeamPage.js';

function RequireAuth({ children }: { children: JSX.Element }): JSX.Element {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <LoadingBlock label="Memeriksa sesi..." />;
  }
  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}

/** Kerangka halaman proyek: bilah atas, navigasi, dan konten halaman aktif. */
function ProjectLayout(): JSX.Element {
  const { projectId = '' } = useParams();
  const projectQuery = useProject(projectId);

  return (
    <AppShell
      projectId={projectId}
      projectName={projectQuery.data?.project.name ?? (projectQuery.isLoading ? 'Memuat...' : 'Proyek')}
    >
      <Outlet />
    </AppShell>
  );
}

function GanttRoute(): JSX.Element {
  const { projectId = '' } = useParams();
  return <GanttPage projectId={projectId} />;
}

function TeamRoute(): JSX.Element {
  const { projectId = '' } = useParams();
  return <TeamPage projectId={projectId} />;
}

function CalendarRoute(): JSX.Element {
  const { projectId = '' } = useParams();
  return <CalendarPage projectId={projectId} />;
}

function AnalysisRoute(): JSX.Element {
  const { projectId = '' } = useParams();
  return <AnalysisPage projectId={projectId} />;
}

export default function App(): JSX.Element {
  const { status } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={status === 'authenticated' ? <Navigate to="/projects" replace /> : <LoginPage />}
      />
      <Route
        path="/register"
        element={status === 'authenticated' ? <Navigate to="/projects" replace /> : <RegisterPage />}
      />

      <Route
        path="/projects"
        element={
          <RequireAuth>
            <AppShell breadcrumb={<span className="text-sm font-semibold text-ink-2">Proyek saya</span>}>
              <ProjectsPage />
            </AppShell>
          </RequireAuth>
        }
      />

      <Route
        element={
          <RequireAuth>
            <ProjectLayout />
          </RequireAuth>
        }
      >
        <Route path="/projects/:projectId/gantt" element={<GanttRoute />} />
        <Route path="/projects/:projectId/team" element={<TeamRoute />} />
        <Route path="/projects/:projectId/calendar" element={<CalendarRoute />} />
        <Route path="/projects/:projectId/analysis" element={<AnalysisRoute />} />
      </Route>

      <Route path="/" element={<Navigate to="/projects" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
