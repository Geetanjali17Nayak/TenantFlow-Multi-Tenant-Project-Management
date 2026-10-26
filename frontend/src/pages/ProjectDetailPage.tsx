import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { projectsApi } from '../api/projects';
import { tasksApi } from '../api/tasks';
import { organizationsApi } from '../api/organizations';
import type { Membership, Project, Task, TaskPriority, TaskStatus } from '../types';
import { useAuth } from '../context/AuthContext';
import { PriorityBadge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import {
  ArrowLeft,
  Plus,
  Search,
  Trash2,
  Loader2,
  Layers,
  Calendar,
  User,
  History,
} from 'lucide-react';

export const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { activeTenant } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Membership[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Task creation modal
  const [isTaskModalOpen, setIsTaskModalOpen] = useState<boolean>(false);
  const [taskTitle, setTaskTitle] = useState<string>('');
  const [taskDesc, setTaskDesc] = useState<string>('');
  const [taskStatus, setTaskStatus] = useState<TaskStatus>('TODO');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('MEDIUM');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [modalLoading, setModalLoading] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchProjectData = async () => {
    if (!id || !activeTenant) return;
    setLoading(true);
    try {
      const [projData, taskData, memberData] = await Promise.all([
        projectsApi.getProjectById(id),
        tasksApi.getProjectTasks(id),
        organizationsApi.getMembers(activeTenant.id),
      ]);
      setProject(projData);
      setTasks(taskData.data);
      setMembers(memberData);
    } catch (err) {
      console.error('Error fetching project detail:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectData();
  }, [id, activeTenant?.id]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !taskTitle.trim()) return;

    setModalLoading(true);
    setModalError(null);
    try {
      await tasksApi.createTask(id, {
        title: taskTitle.trim(),
        description: taskDesc.trim() || undefined,
        status: taskStatus,
        priority: taskPriority,
        assigneeId: assigneeId || undefined,
      });
      setIsTaskModalOpen(false);
      setTaskTitle('');
      setTaskDesc('');
      setAssigneeId('');
      fetchProjectData();
    } catch (err: any) {
      setModalError(err.response?.data?.message || 'Failed to create task');
    } finally {
      setModalLoading(false);
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      await tasksApi.updateTask(taskId, { status: newStatus });
      fetchProjectData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update task status');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      await tasksApi.deleteTask(taskId);
      fetchProjectData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete task');
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '64px' }}>
        <Loader2 size={36} className="spinner" />
      </div>
    );
  }

  if (!project) {
    return (
      <div style={{ textAlign: 'center', padding: '64px' }}>
        <h2>Project Not Found</h2>
        <Link to="/projects" className="btn btn-secondary" style={{ marginTop: '16px' }}>
          Back to Projects
        </Link>
      </div>
    );
  }

  const filteredTasks = tasks.filter((t) => {
    const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Back Link */}
      <div>
        <Link
          to="/projects"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.85rem',
            color: 'var(--text-muted)',
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          <ArrowLeft size={16} /> Back to Projects
        </Link>
      </div>

      {/* Project Banner Header */}
      <div
        className="glass-panel"
        style={{
          padding: '28px',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Layers size={24} color="var(--accent-primary)" />
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff' }}>{project.name}</h1>
          </div>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '8px', maxWidth: '700px' }}>
            {project.description || 'No description provided.'}
          </p>

          <div style={{ display: 'flex', gap: '20px', marginTop: '16px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={14} /> Created: {new Date(project.createdAt).toLocaleDateString()}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Layers size={14} /> Tasks: {tasks.length}
            </span>
            <Link
              to={`/activity?entity=Project&entityId=${project.id}`}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 600 }}
            >
              <History size={14} /> History
            </Link>
          </div>
        </div>

        <button className="btn btn-primary" onClick={() => setIsTaskModalOpen(true)}>
          <Plus size={16} />
          <span>Add Task</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '12px', flex: 1, maxWidth: '500px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="text"
              className="input-field"
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '38px' }}
            />
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
          </div>

          <select
            className="select-field"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: '160px' }}
          >
            <option value="">All Statuses</option>
            <option value="TODO">To Do</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="DONE">Done</option>
          </select>
        </div>
      </div>

      {/* Task List Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Task Title</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Assignee</th>
              <th>Created</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTasks.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  No tasks found in this project.
                </td>
              </tr>
            ) : (
              filteredTasks.map((t) => (
                <tr key={t.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: '#fff' }}>{t.title}</div>
                    {t.description && (
                      <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {t.description}
                      </div>
                    )}
                  </td>
                  <td>
                    <select
                      value={t.status}
                      onChange={(e) => handleStatusChange(t.id, e.target.value as TaskStatus)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'inherit',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      <option value="TODO">To Do</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="DONE">Done</option>
                    </select>
                  </td>
                  <td>
                    <PriorityBadge priority={t.priority} />
                  </td>
                  <td>
                    {t.assignee ? (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <User size={14} color="var(--accent-primary)" />
                        {t.assignee.name}
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Unassigned</span>
                    )}
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {new Date(t.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn-icon" onClick={() => handleDeleteTask(t.id)} title="Delete Task">
                      <Trash2 size={16} color="#fca5a5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Task Modal */}
      <Modal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        title={`Add Task to ${project.name}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsTaskModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleCreateTask} disabled={modalLoading || !taskTitle}>
              {modalLoading ? <Loader2 size={16} className="spinner" /> : 'Create Task'}
            </button>
          </>
        }
      >
        {modalError && <div className="alert-error">{modalError}</div>}
        <form onSubmit={handleCreateTask}>
          <div className="input-group">
            <label className="input-label">Task Title</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Implement JWT refresh strategy"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label className="input-label">Description</label>
            <textarea
              className="textarea-field"
              placeholder="Details and acceptance criteria..."
              value={taskDesc}
              onChange={(e) => setTaskDesc(e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="input-group">
              <label className="input-label">Status</label>
              <select className="select-field" value={taskStatus} onChange={(e) => setTaskStatus(e.target.value as TaskStatus)}>
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="DONE">Done</option>
              </select>
            </div>

            <div className="input-group">
              <label className="input-label">Priority</label>
              <select className="select-field" value={taskPriority} onChange={(e) => setTaskPriority(e.target.value as TaskPriority)}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Assignee (Tenant Member)</label>
            <select className="select-field" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
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
