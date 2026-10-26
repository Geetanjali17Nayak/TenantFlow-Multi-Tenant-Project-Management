import { apiClient } from './apiClient';
import type { PaginatedResult, Project } from '../types';

export interface ProjectQueryParams {
  page?: number;
  limit?: number;
  search?: string;
}

export const projectsApi = {
  getProjects: async (params?: ProjectQueryParams): Promise<PaginatedResult<Project>> => {
    const res = await apiClient.get<PaginatedResult<Project>>('/projects', { params });
    return res.data;
  },

  getProjectById: async (id: string): Promise<Project> => {
    const res = await apiClient.get<Project>(`/projects/${id}`);
    return res.data;
  },

  createProject: async (data: { name: string; description?: string }): Promise<Project> => {
    const res = await apiClient.post<Project>('/projects', data);
    return res.data;
  },

  updateProject: async (id: string, data: { name?: string; description?: string }): Promise<Project> => {
    const res = await apiClient.patch<Project>(`/projects/${id}`, data);
    return res.data;
  },

  deleteProject: async (id: string): Promise<{ message: string }> => {
    const res = await apiClient.delete<{ message: string }>(`/projects/${id}`);
    return res.data;
  },
};
