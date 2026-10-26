import { apiClient } from './apiClient';
import type { AuditLog, PaginatedResult } from '../types';

export interface AuditQueryParams {
  page?: number;
  limit?: number;
  action?: string;
  entity?: string;
}

export const auditApi = {
  getAuditLogs: async (params?: AuditQueryParams): Promise<PaginatedResult<AuditLog>> => {
    const res = await apiClient.get<PaginatedResult<AuditLog>>('/audit-logs', { params });
    return res.data;
  },
};
