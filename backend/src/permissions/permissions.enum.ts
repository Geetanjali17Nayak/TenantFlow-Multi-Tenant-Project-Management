export enum Permission {
  // Organization permissions
  ORG_READ = 'org:read',
  ORG_UPDATE = 'org:update',
  ORG_DELETE = 'org:delete',

  // Member permissions
  MEMBER_READ = 'member:read',
  MEMBER_ADD = 'member:add',
  MEMBER_UPDATE = 'member:update',
  MEMBER_REMOVE = 'member:remove',

  // Project permissions
  PROJECT_CREATE = 'project:create',
  PROJECT_READ = 'project:read',
  PROJECT_UPDATE = 'project:update',
  PROJECT_DELETE = 'project:delete',

  // Task permissions
  TASK_CREATE = 'task:create',
  TASK_READ = 'task:read',
  TASK_UPDATE = 'task:update',
  TASK_DELETE = 'task:delete',

  // Audit Log permissions
  AUDIT_READ = 'audit:read',
}
