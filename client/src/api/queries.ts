import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AnalysisDTO,
  AssignmentCreateInput,
  AssignmentDTO,
  AssignmentUpdateInput,
  CalendarUpdateInput,
  DependencyCreateInput,
  DependencyDTO,
  DependencyUpdateInput,
  HolidayCreateInput,
  HolidayDTO,
  ProjectCreateInput,
  ProjectDTO,
  ProjectListItemDTO,
  ProjectSnapshotDTO,
  ProjectUpdateInput,
  ResourceCreateInput,
  ResourceDTO,
  ResourceUpdateInput,
  TaskCreateInput,
  TaskDTO,
  TaskMoveInput,
  TaskUpdateInput,
} from '@gantt/shared';
import { apiFetch } from './client.js';

export const queryKeys = {
  projects: ['projects'] as const,
  project: (projectId: string) => ['project', projectId] as const,
  analysis: (projectId: string) => ['analysis', projectId] as const,
  resources: (projectId: string) => ['resources', projectId] as const,
};

export function useProjects() {
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: async () => {
      const response = await apiFetch<{ projects: ProjectListItemDTO[] }>('/projects');
      return response.projects;
    },
  });
}

export function useProject(projectId: string) {
  return useQuery({
    queryKey: queryKeys.project(projectId),
    queryFn: () => apiFetch<ProjectSnapshotDTO>(`/projects/${projectId}`),
    enabled: projectId.length > 0,
  });
}

export function useAnalysis(projectId: string) {
  return useQuery({
    queryKey: queryKeys.analysis(projectId),
    queryFn: () => apiFetch<AnalysisDTO>(`/projects/${projectId}/analysis`),
    enabled: projectId.length > 0,
  });
}

export function useResources(projectId: string) {
  return useQuery({
    queryKey: queryKeys.resources(projectId),
    queryFn: async () => {
      const response = await apiFetch<{ resources: ResourceDTO[] }>(`/projects/${projectId}/resources`);
      return response.resources;
    },
    enabled: projectId.length > 0,
  });
}

/** Mengganti daftar tugas pada cache snapshot agar UI langsung sinkron dengan server. */
function useReplaceTasks(projectId: string) {
  const queryClient = useQueryClient();
  return (tasks: TaskDTO[]) => {
    queryClient.setQueryData<ProjectSnapshotDTO>(queryKeys.project(projectId), (current) =>
      current ? { ...current, tasks } : current,
    );
    void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    void queryClient.invalidateQueries({ queryKey: queryKeys.analysis(projectId) });
  };
}

/* --------------------------------------------------------------- projects */

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProjectCreateInput) =>
      apiFetch<{ project: ProjectDTO }>('/projects', { method: 'POST', body: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
}

export function useUpdateProject(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProjectUpdateInput) =>
      apiFetch<{ project: ProjectDTO; tasks: TaskDTO[] }>(`/projects/${projectId}`, {
        method: 'PATCH',
        body: input,
      }),
    onSuccess: (response) => {
      queryClient.setQueryData<ProjectSnapshotDTO>(queryKeys.project(projectId), (current) =>
        current ? { ...current, project: response.project, tasks: response.tasks } : current,
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      void queryClient.invalidateQueries({ queryKey: queryKeys.analysis(projectId) });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) =>
      apiFetch<void>(`/projects/${projectId}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
}

/* ------------------------------------------------------------------ tasks */

export function useCreateTask(projectId: string) {
  const replaceTasks = useReplaceTasks(projectId);
  return useMutation({
    mutationFn: (input: TaskCreateInput) =>
      apiFetch<{ task: TaskDTO; tasks: TaskDTO[] }>(`/projects/${projectId}/tasks`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: (response) => replaceTasks(response.tasks),
  });
}

export function useUpdateTask(projectId: string) {
  const replaceTasks = useReplaceTasks(projectId);
  return useMutation({
    mutationFn: ({ taskId, input }: { taskId: string; input: TaskUpdateInput }) =>
      apiFetch<{ task: TaskDTO; tasks: TaskDTO[] }>(`/tasks/${taskId}`, { method: 'PATCH', body: input }),
    onSuccess: (response) => replaceTasks(response.tasks),
  });
}

export function useDeleteTask(projectId: string) {
  const replaceTasks = useReplaceTasks(projectId);
  return useMutation({
    mutationFn: (taskId: string) => apiFetch<{ tasks: TaskDTO[] }>(`/tasks/${taskId}`, { method: 'DELETE' }),
    onSuccess: (response) => replaceTasks(response.tasks),
  });
}

export function useMoveTask(projectId: string) {
  const replaceTasks = useReplaceTasks(projectId);
  return useMutation({
    mutationFn: ({ taskId, input }: { taskId: string; input: TaskMoveInput }) =>
      apiFetch<{ tasks: TaskDTO[] }>(`/tasks/${taskId}/move`, { method: 'POST', body: input }),
    onSuccess: (response) => replaceTasks(response.tasks),
  });
}

/* ------------------------------------------------------------ dependencies */

export function useCreateDependency(projectId: string) {
  const replaceTasks = useReplaceTasks(projectId);
  return useMutation({
    mutationFn: ({ taskId, input }: { taskId: string; input: DependencyCreateInput }) =>
      apiFetch<{ dependency: DependencyDTO; tasks: TaskDTO[] }>(`/tasks/${taskId}/dependencies`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: (response) => replaceTasks(response.tasks),
  });
}

export function useUpdateDependency(projectId: string) {
  const replaceTasks = useReplaceTasks(projectId);
  return useMutation({
    mutationFn: ({ dependencyId, input }: { dependencyId: string; input: DependencyUpdateInput }) =>
      apiFetch<{ dependency: DependencyDTO; tasks: TaskDTO[] }>(`/dependencies/${dependencyId}`, {
        method: 'PATCH',
        body: input,
      }),
    onSuccess: (response) => replaceTasks(response.tasks),
  });
}

export function useDeleteDependency(projectId: string) {
  const replaceTasks = useReplaceTasks(projectId);
  return useMutation({
    mutationFn: (dependencyId: string) =>
      apiFetch<{ tasks: TaskDTO[] }>(`/dependencies/${dependencyId}`, { method: 'DELETE' }),
    onSuccess: (response) => replaceTasks(response.tasks),
  });
}

/* --------------------------------------------------------------- resources */

export function useCreateResource(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ResourceCreateInput) =>
      apiFetch<{ resource: ResourceDTO }>(`/projects/${projectId}/resources`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.resources(projectId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.analysis(projectId) });
    },
  });
}

export function useUpdateResource(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ resourceId, input }: { resourceId: string; input: ResourceUpdateInput }) =>
      apiFetch<{ resource: ResourceDTO }>(`/resources/${resourceId}`, { method: 'PATCH', body: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.resources(projectId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.analysis(projectId) });
    },
  });
}

export function useDeleteResource(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (resourceId: string) => apiFetch<void>(`/resources/${resourceId}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.resources(projectId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.analysis(projectId) });
    },
  });
}

/* ------------------------------------------------------------- assignments */

export function useCreateAssignment(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, input }: { taskId: string; input: AssignmentCreateInput }) =>
      apiFetch<{ assignment: AssignmentDTO }>(`/tasks/${taskId}/assignments`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.analysis(projectId) });
    },
  });
}

export function useUpdateAssignment(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ assignmentId, input }: { assignmentId: string; input: AssignmentUpdateInput }) =>
      apiFetch<{ assignment: AssignmentDTO }>(`/assignments/${assignmentId}`, {
        method: 'PATCH',
        body: input,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.analysis(projectId) });
    },
  });
}

export function useDeleteAssignment(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assignmentId: string) =>
      apiFetch<void>(`/assignments/${assignmentId}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.analysis(projectId) });
    },
  });
}

/* ---------------------------------------------------------------- calendar */

export function useUpdateCalendar(projectId: string) {
  const replaceTasks = useReplaceTasks(projectId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CalendarUpdateInput) =>
      apiFetch<{ project: ProjectDTO; tasks: TaskDTO[] }>(`/projects/${projectId}/calendar`, {
        method: 'PUT',
        body: input,
      }),
    onSuccess: (response) => {
      queryClient.setQueryData<ProjectSnapshotDTO>(queryKeys.project(projectId), (current) =>
        current ? { ...current, project: response.project } : current,
      );
      replaceTasks(response.tasks);
    },
  });
}

export function useCreateHoliday(projectId: string) {
  const replaceTasks = useReplaceTasks(projectId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: HolidayCreateInput) =>
      apiFetch<{ holiday: HolidayDTO; tasks: TaskDTO[] }>(`/projects/${projectId}/holidays`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: (response) => {
      queryClient.setQueryData<ProjectSnapshotDTO>(queryKeys.project(projectId), (current) =>
        current
          ? {
              ...current,
              holidays: [...current.holidays, response.holiday].sort((a, b) => a.date.localeCompare(b.date)),
            }
          : current,
      );
      replaceTasks(response.tasks);
    },
  });
}

export function useDeleteHoliday(projectId: string) {
  const replaceTasks = useReplaceTasks(projectId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (holidayId: string) =>
      apiFetch<{ tasks: TaskDTO[] }>(`/holidays/${holidayId}`, { method: 'DELETE' }),
    onSuccess: (response, holidayId) => {
      queryClient.setQueryData<ProjectSnapshotDTO>(queryKeys.project(projectId), (current) =>
        current ? { ...current, holidays: current.holidays.filter((item) => item.id !== holidayId) } : current,
      );
      replaceTasks(response.tasks);
    },
  });
}
