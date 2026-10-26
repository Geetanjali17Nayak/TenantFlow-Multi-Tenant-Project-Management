export type Role = 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Membership {
  id: string;
  userId: string;
  organizationId: string;
  role: Role;
  createdAt?: string;
  updatedAt?: string;
  user?: User;
  organization?: Organization;
}

export interface UserOrgMembership extends Organization {
  role: Role;
  membershipId: string;
}

export interface Project {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    tasks: number;
  };
  tasks?: Task[];
}

export interface Task {
  id: string;
  tenantId: string;
  projectId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId?: string | null;
  createdAt: string;
  updatedAt: string;
  assignee?: User | null;
  project?: Project;
}

export interface AuditLog {
  id: string;
  tenantId: string;
  userId?: string | null;
  action: string;
  entity: string;
  entityId: string;
  metadata?: Record<string, any> | null;
  createdAt: string;
  user?: User | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
  message?: string;
}

export interface SwitchTenantResponse {
  message: string;
  tenantId: string;
  role: Role;
  tokens: AuthTokens;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
