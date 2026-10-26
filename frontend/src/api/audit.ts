import { apiClient } from './apiClient';
import type { AuditLog, Paginated } from '../types';

export interface AuditQueryParams {
  page?: number;
  limit?: number;
  action?: string;
  entity?: string;
}

export const auditApi = {
  getAuditLogs: async (params?: AuditQueryParams): Promise<Paginated<AuditLog>> => {
    const res = await apiClient.get<Paginated<AuditLog>>('/audit-logs', { params });
    return res.data;
  },
};
