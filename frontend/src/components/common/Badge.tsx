import React from 'react';
import type { Role, TaskPriority, TaskStatus } from '../../types';
import { STATUS_LABELS } from './statusLabels';

export const RoleBadge: React.FC<{ role: Role }> = ({ role }) => {
  return <span className="badge badge-role">{role}</span>;
};

export const StatusBadge: React.FC<{ status: TaskStatus }> = ({ status }) => {
  const map: Record<TaskStatus, { label: string; className: string }> = {
    TODO: { label: STATUS_LABELS.TODO, className: 'badge-todo' },
    IN_PROGRESS: { label: STATUS_LABELS.IN_PROGRESS, className: 'badge-in-progress' },
    DONE: { label: STATUS_LABELS.DONE, className: 'badge-done' },
  };

  const item = map[status] || { label: status, className: 'badge-todo' };
  return <span className={`badge ${item.className}`}>{item.label}</span>;
};

export const PriorityBadge: React.FC<{ priority: TaskPriority }> = ({ priority }) => {
  const map: Record<TaskPriority, { label: string; className: string }> = {
    LOW: { label: 'Low', className: 'badge-low' },
    MEDIUM: { label: 'Medium', className: 'badge-medium' },
    HIGH: { label: 'High', className: 'badge-high' },
    URGENT: { label: 'Urgent', className: 'badge-urgent' },
  };

  const item = map[priority] || { label: priority, className: 'badge-low' };
  return <span className={`badge ${item.className}`}>{item.label}</span>;
};
