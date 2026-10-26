import { apiClient } from './apiClient';
import type { ChangePasswordInput, UpdateProfileInput, User } from '../types';

export const usersApi = {
  updateProfile: async (data: UpdateProfileInput): Promise<User> => {
    const res = await apiClient.patch<User>('/users/me', data);
    return res.data;
  },

  changePassword: async (data: ChangePasswordInput): Promise<{ message: string }> => {
    const res = await apiClient.patch<{ message: string }>('/users/me/password', data);
    return res.data;
  },
};
