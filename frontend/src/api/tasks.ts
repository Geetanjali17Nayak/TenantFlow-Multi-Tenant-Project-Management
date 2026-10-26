import { apiClient } from './apiClient';
import type { PaginatedResult, Task, TaskPriority, TaskStatus } from '../types';

export interface TaskQueryParams {
  page?: number;
  limit?: number;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string;
  projectId?: string;
  search?: string;
}

export const tasksApi = {
  getTasks: async (params?: TaskQueryParams): Promise<PaginatedResult<Task>> => {
    const res = await apiClient.get<PaginatedResult<Task>>('/tasks', { params });
    return res.data;
  },

  getProjectTasks: async (projectId: string, params?: TaskQueryParams): Promise<PaginatedResult<Task>> => {
    const res = await apiClient.get<PaginatedResult<Task>>(`/projects/${projectId}/tasks`, { params });
    return res.data;
  },

  getTaskById: async (id: string): Promise<Task> => {
    const res = await apiClient.get<Task>(`/tasks/${id}`);
    return res.data;
  },

  createTask: async (
    projectId: string,
    data: {
      title: string;
      description?: string;
      status?: TaskStatus;
      priority?: TaskPriority;
      assigneeId?: string;
    }
  ): Promise<Task> => {
    const res = await apiClient.post<Task>(`/projects/${projectId}/tasks`, data);
    return res.data;
  },

  updateTask: async (
    id: string,
    data: {
      title?: string;
      description?: string;
      status?: TaskStatus;
      priority?: TaskPriority;
      assigneeId?: string | null;
    }
  ): Promise<Task> => {
    const res = await apiClient.patch<Task>(`/tasks/${id}`, data);
    return res.data;
  },

  deleteTask: async (id: string): Promise<{ message: string }> => {
    const res = await apiClient.delete<{ message: string }>(`/tasks/${id}`);
    return res.data;
  },
};
