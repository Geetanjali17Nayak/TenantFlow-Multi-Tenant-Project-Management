export enum AuditAction {
  TASK_CREATED = 'TASK_CREATED',
  TASK_UPDATED = 'TASK_UPDATED',
  TASK_DELETED = 'TASK_DELETED',
  PROJECT_CREATED = 'PROJECT_CREATED',
  PROJECT_UPDATED = 'PROJECT_UPDATED',
  PROJECT_DELETED = 'PROJECT_DELETED',
  MEMBER_ADDED = 'MEMBER_ADDED',
  MEMBER_REMOVED = 'MEMBER_REMOVED',
  ROLE_CHANGED = 'ROLE_CHANGED',
}

export enum AuditEntity {
  TASK = 'Task',
  PROJECT = 'Project',
  MEMBER = 'Member',
}

export type FieldChange<T = unknown> = { from: T; to: T };

// Long text fields (descriptions) are recorded as changed without storing their content
export type AuditChanges = Record<string, FieldChange | { changed: true }>;
