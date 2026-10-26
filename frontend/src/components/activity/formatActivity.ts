import type { ActivityItem, FieldChange, TaskStatus } from '../../types';
import { STATUS_LABELS } from '../common/statusLabels';

export interface FormattedActivity {
  // Sentence pieces after the actor's name: "{before} “{target}” {after}"
  before: string;
  target?: string;
  after?: string;
  detail?: string;
  // Where the target links to; omitted for deleted entities
  href?: string;
}

const FIELD_LABELS: Record<string, string> = {
  title: 'title',
  name: 'name',
  status: 'status',
  priority: 'priority',
  assigneeId: 'assignee',
  description: 'description',
};

const isFieldChange = (value: unknown): value is FieldChange =>
  typeof value === 'object' && value !== null && 'from' in value && 'to' in value;

const changedFields = (changes: Record<string, unknown>) =>
  // assigneeName travels with assigneeId and isn't a separate field for display
  Object.keys(changes).filter((key) => key !== 'assigneeName');

export const formatActivity = (item: ActivityItem): FormattedActivity => {
  const meta = item.metadata ?? {};
  const changes = meta.changes ?? {};
  const projectHref = meta.projectId ? `/projects/${meta.projectId}` : undefined;

  switch (item.action) {
    case 'TASK_CREATED':
      return { before: 'created task', target: meta.title, href: projectHref, detail: meta.projectName };

    case 'TASK_UPDATED': {
      const fields = changedFields(changes);
      const status = changes.status;
      const assigneeName = changes.assigneeName;
      const base = { target: meta.title, href: projectHref };

      if (fields.length === 1 && fields[0] === 'status' && isFieldChange(status)) {
        const label = STATUS_LABELS[status.to as TaskStatus] ?? String(status.to);
        return { ...base, before: 'moved', after: `to ${label}`, detail: meta.projectName };
      }
      if (fields.length === 1 && fields[0] === 'assigneeId' && isFieldChange(assigneeName)) {
        return assigneeName.to
          ? { ...base, before: 'assigned', after: `to ${assigneeName.to}`, detail: meta.projectName }
          : { ...base, before: 'unassigned', detail: meta.projectName };
      }
      if (fields.length === 1 && fields[0] === 'description') {
        return { ...base, before: 'updated the description of', detail: meta.projectName };
      }
      if (fields.length === 1 && fields[0] === 'title' && isFieldChange(changes.title)) {
        return { ...base, before: 'renamed task', after: `(was “${changes.title.from}”)`, detail: meta.projectName };
      }
      return {
        ...base,
        before: 'updated',
        detail: [fields.map((f) => FIELD_LABELS[f] ?? f).join(', '), meta.projectName].filter(Boolean).join(' · '),
      };
    }

    case 'TASK_DELETED':
      return { before: 'deleted task', target: meta.title, detail: meta.projectName };

    case 'PROJECT_CREATED':
      return { before: 'created project', target: meta.name, href: `/projects/${item.entityId}` };

    case 'PROJECT_UPDATED': {
      const fields = changedFields(changes);
      if (fields.length === 1 && fields[0] === 'name' && isFieldChange(changes.name)) {
        return {
          before: 'renamed project',
          target: meta.name,
          after: `(was “${changes.name.from}”)`,
          href: `/projects/${item.entityId}`,
        };
      }
      return {
        before: 'updated project',
        target: meta.name,
        href: `/projects/${item.entityId}`,
        detail: fields.map((f) => FIELD_LABELS[f] ?? f).join(', '),
      };
    }

    case 'PROJECT_DELETED': {
      const count = meta.taskCount ?? 0;
      return {
        before: 'deleted project',
        target: meta.name,
        after: count > 0 ? `and its ${count} ${count === 1 ? 'task' : 'tasks'}` : undefined,
      };
    }

    case 'MEMBER_ADDED':
      return { before: 'added', target: meta.memberName, after: meta.role ? `as ${meta.role}` : undefined, href: '/organization' };

    case 'ROLE_CHANGED': {
      const role = changes.role;
      return {
        before: 'changed the role of',
        target: meta.memberName,
        after: isFieldChange(role) ? `from ${role.from} to ${role.to}` : undefined,
        href: '/organization',
      };
    }

    case 'MEMBER_REMOVED':
      return meta.selfRemoval
        ? { before: 'left the organization' }
        : { before: 'removed', target: meta.memberName, after: 'from the organization' };

    default:
      // Unknown or future actions still render instead of breaking the feed
      return { before: `${item.action.toLowerCase().replace(/_/g, ' ')} on ${item.entity}` };
  }
};
