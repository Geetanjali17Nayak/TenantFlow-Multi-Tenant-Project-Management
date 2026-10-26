import { apiClient } from './apiClient';
import type { ActivityEntity, ActivityItem, Paginated } from '../types';

export interface ActivityQueryParams {
  page?: number;
  limit?: number;
  entity?: ActivityEntity;
  entityId?: string;
  actorId?: string;
  from?: string;
  to?: string;
}

export const activityApi = {
  getActivity: async (params?: ActivityQueryParams): Promise<Paginated<ActivityItem>> => {
    const res = await apiClient.get<Paginated<ActivityItem>>('/activity', { params });
    return res.data;
  },
};
