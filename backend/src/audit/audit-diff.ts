import { AuditChanges } from './audit.constants';

export interface TaskSnapshot {
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  assigneeId?: string | null;
  assignee?: { name: string } | null;
}

export interface ProjectSnapshot {
  name: string;
  description?: string | null;
}

export function diffTask(before: TaskSnapshot, after: TaskSnapshot): AuditChanges {
  const changes: AuditChanges = {};

  for (const field of ['title', 'status', 'priority'] as const) {
    if (before[field] !== after[field]) {
      changes[field] = { from: before[field], to: after[field] };
    }
  }

  const beforeAssignee = before.assigneeId ?? null;
  const afterAssignee = after.assigneeId ?? null;
  if (beforeAssignee !== afterAssignee) {
    changes.assigneeId = { from: beforeAssignee, to: afterAssignee };
    changes.assigneeName = { from: before.assignee?.name ?? null, to: after.assignee?.name ?? null };
  }

  if ((before.description ?? null) !== (after.description ?? null)) {
    changes.description = { changed: true };
  }

  return changes;
}

export function diffProject(before: ProjectSnapshot, after: ProjectSnapshot): AuditChanges {
  const changes: AuditChanges = {};

  if (before.name !== after.name) {
    changes.name = { from: before.name, to: after.name };
  }

  if ((before.description ?? null) !== (after.description ?? null)) {
    changes.description = { changed: true };
  }

  return changes;
}
