export type Role = 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
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
  joinedAt?: string;
}

export interface UpdateProfileInput {
  name?: string;
  avatarUrl?: string | null;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
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

export type ActivityAction =
  | 'TASK_CREATED'
  | 'TASK_UPDATED'
  | 'TASK_DELETED'
  | 'PROJECT_CREATED'
  | 'PROJECT_UPDATED'
  | 'PROJECT_DELETED'
  | 'MEMBER_ADDED'
  | 'MEMBER_REMOVED'
  | 'ROLE_CHANGED';

export type ActivityEntity = 'Task' | 'Project' | 'Member';

export interface FieldChange<T = unknown> {
  from: T;
  to: T;
}

export interface ActivityMetadata {
  title?: string;
  name?: string;
  projectId?: string;
  projectName?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string | null;
  assigneeName?: string | null;
  taskCount?: number;
  memberName?: string;
  memberEmail?: string;
  membershipId?: string;
  role?: Role;
  selfRemoval?: boolean;
  changes?: Record<string, FieldChange | { changed: true }>;
}

export interface ActivityItem {
  id: string;
  action: ActivityAction | string; // string keeps unknown future actions renderable
  entity: ActivityEntity;
  entityId: string;
  actor: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'> | null;
  metadata: ActivityMetadata | null;
  createdAt: string;
}

// Matches the backend list shape { data, meta }
export interface Paginated<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// Legacy flat shape; the backend returns { data, meta }. Prefer Paginated<T>.
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
