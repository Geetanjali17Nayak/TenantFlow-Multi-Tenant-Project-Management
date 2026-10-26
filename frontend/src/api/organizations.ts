import { apiClient } from './apiClient';
import type { Membership, Organization, Role, SwitchTenantResponse, UserOrgMembership } from '../types';

export const organizationsApi = {
  getUserOrganizations: async (): Promise<UserOrgMembership[]> => {
    const res = await apiClient.get<UserOrgMembership[]>('/organizations');
    return res.data;
  },

  createOrganization: async (name: string, slug: string): Promise<Organization> => {
    const res = await apiClient.post<Organization>('/organizations', { name, slug });
    return res.data;
  },

  getOrganizationById: async (orgId: string): Promise<Organization> => {
    const res = await apiClient.get<Organization>(`/organizations/${orgId}`);
    return res.data;
  },

  updateOrganization: async (orgId: string, data: { name?: string; slug?: string }): Promise<Organization> => {
    const res = await apiClient.patch<Organization>(`/organizations/${orgId}`, data);
    return res.data;
  },

  getMembers: async (orgId: string): Promise<Membership[]> => {
    const res = await apiClient.get<Membership[]>(`/organizations/${orgId}/members`);
    return res.data;
  },

  addMember: async (orgId: string, email: string, role: Role): Promise<Membership> => {
    const res = await apiClient.post<Membership>(`/organizations/${orgId}/members`, { email, role });
    return res.data;
  },

  updateMemberRole: async (orgId: string, memberId: string, role: Role): Promise<Membership> => {
    const res = await apiClient.patch<Membership>(`/organizations/${orgId}/members/${memberId}`, { role });
    return res.data;
  },

  removeMember: async (orgId: string, memberId: string): Promise<{ message: string }> => {
    const res = await apiClient.delete<{ message: string }>(`/organizations/${orgId}/members/${memberId}`);
    return res.data;
  },

  switchTenant: async (orgId: string): Promise<SwitchTenantResponse> => {
    const res = await apiClient.post<SwitchTenantResponse>(`/organizations/${orgId}/switch`);
    return res.data;
  },
};
