import React, { createContext, useContext, useEffect, useState } from 'react';
import { authApi } from '../api/auth';
import { organizationsApi } from '../api/organizations';
import type { User, UserOrgMembership } from '../types';

interface AuthContextType {
  user: User | null;
  organizations: UserOrgMembership[];
  activeTenant: UserOrgMembership | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (name: string, email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  switchTenant: (orgId: string) => Promise<void>;
  refreshOrganizations: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [organizations, setOrganizations] = useState<UserOrgMembership[]>([]);
  const [activeTenant, setActiveTenant] = useState<UserOrgMembership | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadInitialData = async () => {
    const token = localStorage.getItem('tenantflow_access_token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const userProfile = await authApi.getMe();
      setUser(userProfile);

      const orgs = await organizationsApi.getUserOrganizations();
      setOrganizations(orgs);

      const savedTenantId = localStorage.getItem('tenantflow_active_tenant_id');
      if (savedTenantId && orgs.length > 0) {
        const matching = orgs.find((o) => o.id === savedTenantId);
        if (matching) {
          setActiveTenant(matching);
        } else {
          setActiveTenant(orgs[0]);
          localStorage.setItem('tenantflow_active_tenant_id', orgs[0].id);
        }
      } else if (orgs.length > 0) {
        setActiveTenant(orgs[0]);
        localStorage.setItem('tenantflow_active_tenant_id', orgs[0].id);
      }
    } catch (err) {
      console.error('Failed to load user session:', err);
      localStorage.clear();
      setUser(null);
      setOrganizations([]);
      setActiveTenant(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const login = async (email: string, pass: string) => {
    setLoading(true);
    try {
      const res = await authApi.login(email, pass);
      localStorage.setItem('tenantflow_access_token', res.tokens.accessToken);
      localStorage.setItem('tenantflow_refresh_token', res.tokens.refreshToken);
      setUser(res.user);

      const orgs = await organizationsApi.getUserOrganizations();
      setOrganizations(orgs);

      if (orgs.length > 0) {
        setActiveTenant(orgs[0]);
        localStorage.setItem('tenantflow_active_tenant_id', orgs[0].id);
      } else {
        setActiveTenant(null);
        localStorage.removeItem('tenantflow_active_tenant_id');
      }
    } finally {
      setLoading(false);
    }
  };

  const register = async (name: string, email: string, pass: string) => {
    setLoading(true);
    try {
      const res = await authApi.register(name, email, pass);
      localStorage.setItem('tenantflow_access_token', res.tokens.accessToken);
      localStorage.setItem('tenantflow_refresh_token', res.tokens.refreshToken);
      setUser(res.user);

      const orgs = await organizationsApi.getUserOrganizations();
      setOrganizations(orgs);

      if (orgs.length > 0) {
        setActiveTenant(orgs[0]);
        localStorage.setItem('tenantflow_active_tenant_id', orgs[0].id);
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (e) {
      console.warn('Logout API error:', e);
    } finally {
      localStorage.clear();
      setUser(null);
      setOrganizations([]);
      setActiveTenant(null);
    }
  };

  const switchTenant = async (orgId: string) => {
    try {
      const switchRes = await organizationsApi.switchTenant(orgId);
      localStorage.setItem('tenantflow_access_token', switchRes.tokens.accessToken);
      localStorage.setItem('tenantflow_refresh_token', switchRes.tokens.refreshToken);
      localStorage.setItem('tenantflow_active_tenant_id', orgId);

      const orgs = await organizationsApi.getUserOrganizations();
      setOrganizations(orgs);

      const target = orgs.find((o) => o.id === orgId);
      if (target) {
        setActiveTenant(target);
      }
    } catch (err) {
      console.error('Failed to switch tenant:', err);
      throw err;
    }
  };

  const refreshOrganizations = async () => {
    const orgs = await organizationsApi.getUserOrganizations();
    setOrganizations(orgs);
    const savedTenantId = localStorage.getItem('tenantflow_active_tenant_id');
    if (savedTenantId) {
      const target = orgs.find((o) => o.id === savedTenantId);
      if (target) {
        setActiveTenant(target);
      } else if (orgs.length > 0) {
        setActiveTenant(orgs[0]);
        localStorage.setItem('tenantflow_active_tenant_id', orgs[0].id);
      }
    } else if (orgs.length > 0) {
      setActiveTenant(orgs[0]);
      localStorage.setItem('tenantflow_active_tenant_id', orgs[0].id);
    }
  };

  const refreshProfile = async () => {
    const me = await authApi.getMe();
    setUser(me);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        organizations,
        activeTenant,
        loading,
        login,
        register,
        logout,
        switchTenant,
        refreshOrganizations,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
