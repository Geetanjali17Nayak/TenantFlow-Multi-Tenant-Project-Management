import React, { useEffect, useState } from 'react';
import { tasksApi } from '../api/tasks';
import type { TaskQueryParams } from '../api/tasks';
import { projectsApi } from '../api/projects';
import { organizationsApi } from '../api/organizations';
import type { Membership, Project, Task, TaskPriority, TaskStatus } from '../types';
import { useAuth } from '../context/AuthContext';
import { StatusBadge, PriorityBadge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import {
  Kanban,
  List,
  Plus,
  Search,
  Trash2,
  Edit2,
  Loader2,
  User,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';

export const TasksPage: React.FC = () => {
  const { activeTenant } = useAuth();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<Membership[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // View state: 'kanban' | 'table'
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');

  // Filters
  const [search, setSearch] = useState<string>('');
  const [statusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [projectFilter, setProjectFilter] = useState<string>('');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('');

  // Pagination for table view
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [isEditOpen, setIsEditOpen] = useState<boolean>(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Form State
  const [formTitle, setFormTitle] = useState<string>('');
  const [formDesc, setFormDesc] = useState<string>('');
  const [formProjectId, setFormProjectId] = useState<string>('');
  const [formStatus, setFormStatus] = useState<TaskStatus>('TODO');
  const [formPriority, setFormPriority] = useState<TaskPriority>('MEDIUM');
  const [formAssigneeId, setFormAssigneeId] = useState<string>('');

  const [submitLoading, setSubmitLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTasksData = async () => {
    if (!activeTenant) return;
    setLoading(true);
    try {
      const params: TaskQueryParams = {
        page,
        limit: viewMode === 'kanban' ? 50 : 15,
        search: search || undefined,
        status: (statusFilter as TaskStatus) || undefined,
        priority: (priorityFilter as TaskPriority) || undefined,
        projectId: projectFilter || undefined,
        assigneeId: assigneeFilter || undefined,
      };

      const [taskRes, projRes, memberRes] = await Promise.all([
        tasksApi.getTasks(params),
        projectsApi.getProjects({ limit: 100 }),
        organizationsApi.getMembers(activeTenant.id),
      ]);

      setTasks(taskRes.data);
      setTotalPages(taskRes.totalPages || 1);
      setProjects(projRes.data);
      setMembers(memberRes);
    } catch (err) {
      console.error('Error fetching tasks page data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasksData();
  }, [
    activeTenant?.id,
    page,
    search,
    statusFilter,
    priorityFilter,
    projectFilter,
    assigneeFilter,
    viewMode,
  ]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formProjectId || !formTitle.trim()) return;

    setSubmitLoading(true);
    setError(null);
    try {
      await tasksApi.createTask(formProjectId, {
        title: formTitle.trim(),
        description: formDesc.trim() || undefined,
        status: formStatus,
        priority: formPriority,
        assigneeId: formAssigneeId || undefined,
      });
      setIsCreateOpen(false);
      resetForm();
      fetchTasksData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create task');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !formTitle.trim()) return;

    setSubmitLoading(true);
    setError(null);
    try {
      await tasksApi.updateTask(editingTask.id, {
        title: formTitle.trim(),
        description: formDesc.trim() || undefined,
        status: formStatus,
        priority: formPriority,
        assigneeId: formAssigneeId ? formAssigneeId : null,
      });
      setIsEditOpen(false);
      setEditingTask(null);
      resetForm();
      fetchTasksData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update task');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleQuickStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      await tasksApi.updateTask(taskId, { status: newStatus });
      fetchTasksData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update task status');
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      await tasksApi.deleteTask(taskId);
      fetchTasksData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete task');
    }
  };

  const openCreateModal = () => {
    resetForm();
    if (projects.length > 0) setFormProjectId(projects[0].id);
    setError(null);
    setIsCreateOpen(true);
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setFormTitle(task.title);
    setFormDesc(task.description || '');
    setFormProjectId(task.projectId);
    setFormStatus(task.status);
    setFormPriority(task.priority);
    setFormAssigneeId(task.assigneeId || '');
    setError(null);
    setIsEditOpen(true);
  };

  const resetForm = () => {
    setFormTitle('');
    setFormDesc('');
    setFormProjectId('');
    setFormStatus('TODO');
    setFormPriority('MEDIUM');
    setFormAssigneeId('');
  };

  const getTasksByStatus = (status: TaskStatus) => tasks.filter((t) => t.status === status);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff' }}>Tasks Management</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Organize tasks, assign team members, and track progress
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* View toggle */}
          <div
            style={{
              display: 'flex',
              background: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-sm)',
              padding: '3px',
              border: '1px solid var(--border-color)',
            }}
          >
            <button
              onClick={() => setViewMode('kanban')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                background: viewMode === 'kanban' ? 'var(--accent-primary)' : 'transparent',
                color: viewMode === 'kanban' ? '#fff' : 'var(--text-secondary)',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.825rem',
              }}
            >
              <Kanban size={15} /> Board
            </button>
            <button
              onClick={() => setViewMode('table')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                background: viewMode === 'table' ? 'var(--accent-primary)' : 'transparent',
                color: viewMode === 'table' ? '#fff' : 'var(--text-secondary)',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.825rem',
              }}
            >
              <List size={15} /> List Table
            </button>
          </div>

          <button className="btn btn-primary" onClick={openCreateModal}>
            <Plus size={16} />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div
        className="glass-card"
        style={{
          padding: '16px 20px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
        }}
      >
        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
          <input
            type="text"
            className="input-field"
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            style={{ paddingLeft: '38px' }}
          />
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
        </div>

        <select
          className="select-field"
          value={projectFilter}
          onChange={(e) => {
            setProjectFilter(e.target.value);
            setPage(1);
          }}
          style={{ width: '180px' }}
        >
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <select
          className="select-field"
          value={priorityFilter}
          onChange={(e) => {
            setPriorityFilter(e.target.value);
            setPage(1);
          }}
          style={{ width: '150px' }}
        >
          <option value="">All Priorities</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="URGENT">Urgent</option>
        </select>

        <select
          className="select-field"
          value={assigneeFilter}
          onChange={(e) => {
            setAssigneeFilter(e.target.value);
            setPage(1);
          }}
          style={{ width: '170px' }}
        >
          <option value="">All Assignees</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.user?.name || m.user?.email}
            </option>
          ))}
        </select>
      </div>

      {/* Content View */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '64px' }}>
          <Loader2 size={36} className="spinner" />
        </div>
      ) : viewMode === 'kanban' ? (
        /* KANBAN BOARD VIEW */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
          <KanbanColumn
            title="To Do"
            status="TODO"
            tasks={getTasksByStatus('TODO')}
            color="var(--status-todo)"
            onStatusChange={handleQuickStatusChange}
            onEdit={openEditModal}
            onDelete={handleDelete}
          />

          <KanbanColumn
            title="In Progress"
            status="IN_PROGRESS"
            tasks={getTasksByStatus('IN_PROGRESS')}
            color="var(--status-in-progress)"
            onStatusChange={handleQuickStatusChange}
            onEdit={openEditModal}
            onDelete={handleDelete}
          />

          <KanbanColumn
            title="Done"
            status="DONE"
            tasks={getTasksByStatus('DONE')}
            color="var(--status-done)"
            onStatusChange={handleQuickStatusChange}
            onEdit={openEditModal}
            onDelete={handleDelete}
          />
        </div>
      ) : (
        /* TABLE LIST VIEW */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Project</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Assignee</th>
                  <th>Created</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tasks.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                      No tasks found matching query.
                    </td>
                  </tr>
                ) : (
                  tasks.map((task) => (
                    <tr key={task.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: '#fff' }}>{task.title}</div>
                        {task.description && (
                          <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>{task.description}</div>
                        )}
                      </td>
                      <td>
                        {task.project ? (
                          <span style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                            {task.project.name}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>
                        <StatusBadge status={task.status} />
                      </td>
                      <td>
                        <PriorityBadge priority={task.priority} />
                      </td>
                      <td>
                        {task.assignee ? (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <User size={14} color="var(--accent-primary)" />
                            {task.assignee.name}
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Unassigned</span>
                        )}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(task.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '4px' }}>
                          <button className="btn-icon" onClick={() => openEditModal(task)} title="Edit Task">
                            <Edit2 size={16} />
                          </button>
                          <button className="btn-icon" onClick={() => handleDelete(task.id)} title="Delete Task">
                            <Trash2 size={16} color="#fca5a5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
              <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft size={16} /> Previous
              </button>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                Page {page} of {totalPages}
              </span>
              <button className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                Next <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Create Task Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Task"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleCreateSubmit}
              disabled={submitLoading || !formTitle || !formProjectId}
            >
              {submitLoading ? <Loader2 size={16} className="spinner" /> : 'Create Task'}
            </button>
          </>
        }
      >
        {error && <div className="alert-error">{error}</div>}
        <form onSubmit={handleCreateSubmit}>
          <div className="input-group">
            <label className="input-label">Project</label>
            <select
              className="select-field"
              value={formProjectId}
              onChange={(e) => setFormProjectId(e.target.value)}
              required
            >
              <option value="" disabled>
                Select Target Project
              </option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label className="input-label">Task Title</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Implement multi-tenant audit logs"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label className="input-label">Description</label>
            <textarea
              className="textarea-field"
              placeholder="Detailed description..."
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="input-group">
              <label className="input-label">Status</label>
              <select className="select-field" value={formStatus} onChange={(e) => setFormStatus(e.target.value as TaskStatus)}>
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="DONE">Done</option>
              </select>
            </div>

            <div className="input-group">
              <label className="input-label">Priority</label>
              <select className="select-field" value={formPriority} onChange={(e) => setFormPriority(e.target.value as TaskPriority)}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Assignee (Tenant Member)</label>
            <select className="select-field" value={formAssigneeId} onChange={(e) => setFormAssigneeId(e.target.value)}>
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.user?.name || m.user?.email} ({m.role})
                </option>
              ))}
            </select>
          </div>
        </form>
      </Modal>

      {/* Edit Task Modal */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Edit Task"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsEditOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleEditSubmit} disabled={submitLoading || !formTitle}>
              {submitLoading ? <Loader2 size={16} className="spinner" /> : 'Save Changes'}
            </button>
          </>
        }
      >
        {error && <div className="alert-error">{error}</div>}
        <form onSubmit={handleEditSubmit}>
          <div className="input-group">
            <label className="input-label">Task Title</label>
            <input
              type="text"
              className="input-field"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label className="input-label">Description</label>
            <textarea className="textarea-field" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="input-group">
              <label className="input-label">Status</label>
              <select className="select-field" value={formStatus} onChange={(e) => setFormStatus(e.target.value as TaskStatus)}>
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="DONE">Done</option>
              </select>
            </div>

            <div className="input-group">
              <label className="input-label">Priority</label>
              <select className="select-field" value={formPriority} onChange={(e) => setFormPriority(e.target.value as TaskPriority)}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Assignee</label>
            <select className="select-field" value={formAssigneeId} onChange={(e) => setFormAssigneeId(e.target.value)}>
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.user?.name || m.user?.email} ({m.role})
                </option>
              ))}
            </select>
          </div>
        </form>
      </Modal>
    </div>
  );
};

// Sub-component for Kanban Column
interface KanbanColumnProps {
  title: string;
  status: TaskStatus;
  tasks: Task[];
  color: string;
  onStatusChange: (id: string, s: TaskStatus) => void;
  onEdit: (t: Task) => void;
  onDelete: (id: string) => void;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({
  title,
  status,
  tasks,
  color,
  onStatusChange,
  onEdit,
  onDelete,
}) => {
  return (
    <div
      className="glass-card"
      style={{
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        background: 'rgba(17, 24, 39, 0.4)',
        minHeight: '600px',
      }}
    >
      {/* Column Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color }} />
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>{title}</h3>
        </div>
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            background: 'var(--bg-tertiary)',
            color: 'var(--text-secondary)',
            padding: '2px 8px',
            borderRadius: '999px',
          }}
        >
          {tasks.length}
        </span>
      </div>

      {/* Task Cards in Column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflowY: 'auto' }}>
        {tasks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 12px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            No tasks in {title.toLowerCase()}
          </div>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              style={{
                padding: '14px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div>
                {task.project && (
                  <span style={{ fontSize: '0.725rem', fontWeight: 600, color: 'var(--accent-primary)', display: 'block', marginBottom: '2px' }}>
                    {task.project.name}
                  </span>
                )}
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff' }}>{task.title}</div>
                {task.description && (
                  <p style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.3 }}>
                    {task.description}
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                <PriorityBadge priority={task.priority} />

                {task.assignee ? (
                  <span style={{ fontSize: '0.725rem', color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px' }}>
                    {task.assignee.name}
                  </span>
                ) : (
                  <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>Unassigned</span>
                )}
              </div>

              {/* Status transition controls */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderTop: '1px solid var(--border-color)',
                  paddingTop: '8px',
                  fontSize: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', gap: '4px' }}>
                  {status !== 'TODO' && (
                    <button
                      className="btn-icon"
                      style={{ padding: '2px 6px', fontSize: '0.7rem' }}
                      onClick={() => onStatusChange(task.id, status === 'DONE' ? 'IN_PROGRESS' : 'TODO')}
                      title="Move backward"
                    >
                      ←
                    </button>
                  )}
                  {status !== 'DONE' && (
                    <button
                      className="btn-icon"
                      style={{ padding: '2px 6px', fontSize: '0.7rem' }}
                      onClick={() => onStatusChange(task.id, status === 'TODO' ? 'IN_PROGRESS' : 'DONE')}
                      title="Move forward"
                    >
                      →
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '4px' }}>
                  <button className="btn-icon" onClick={() => onEdit(task)} title="Edit Task">
                    <Edit2 size={14} />
                  </button>
                  <button className="btn-icon" onClick={() => onDelete(task.id)} title="Delete Task">
                    <Trash2 size={14} color="#fca5a5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
