import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { projectsApi } from '../api/projects';
import { tasksApi } from '../api/tasks';
import { organizationsApi } from '../api/organizations';
import { activityApi } from '../api/activity';
import type { ActivityItem, Project, Task } from '../types';
import { ActivityFeed } from '../components/activity/ActivityFeed';
import { StatusBadge, PriorityBadge } from '../components/common/Badge';
import { CreateOrganizationModal } from '../components/common/CreateOrganizationModal';
import {
  FolderKanban,
  CheckCircle2,
  Clock,
  ListTodo,
  Users,
  Plus,
  ArrowRight,
  Loader2,
  Building2,
  TrendingUp,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { user, activeTenant } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [memberCount, setMemberCount] = useState<number>(0);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [activityError, setActivityError] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [isCreateOrgOpen, setIsCreateOrgOpen] = useState<boolean>(false);

  const fetchDashboardData = async () => {
    if (!activeTenant) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [projRes, taskRes, memberRes, activityRes] = await Promise.allSettled([
        projectsApi.getProjects({ limit: 5 }),
        tasksApi.getTasks({ limit: 10 }),
        organizationsApi.getMembers(activeTenant.id),
        activityApi.getActivity({ limit: 5 }),
      ]);

      if (projRes.status === 'fulfilled') setProjects(projRes.value.data);
      if (taskRes.status === 'fulfilled') setTasks(taskRes.value.data);
      if (memberRes.status === 'fulfilled') setMemberCount(memberRes.value.length);
      if (activityRes.status === 'fulfilled') setActivity(activityRes.value.data);
      setActivityError(activityRes.status === 'rejected');
    } catch (err) {
      console.error('Error fetching dashboard metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [activeTenant?.id]);

  if (!activeTenant) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 20px' }}>
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '20px',
            background: 'var(--accent-gradient)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '20px',
          }}
        >
          <Building2 size={32} color="#fff" />
        </div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff' }}>No Active Organization</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: '8px', maxWidth: '460px', margin: '8px auto 24px' }}>
          You do not currently belong to an organization or haven't selected an active tenant.
        </p>
        <button className="btn btn-primary" onClick={() => setIsCreateOrgOpen(true)}>
          <Plus size={18} />
          <span>Create Your First Organization</span>
        </button>
        <CreateOrganizationModal isOpen={isCreateOrgOpen} onClose={() => setIsCreateOrgOpen(false)} />
      </div>
    );
  }

  const todoTasks = tasks.filter((t) => t.status === 'TODO').length;
  const inProgressTasks = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
  const doneTasks = tasks.filter((t) => t.status === 'DONE').length;
  const totalTasks = tasks.length;
  const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Hero Welcome Header */}
      <div
        className="glass-panel"
        style={{
          padding: '28px 32px',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(168, 85, 247, 0.1) 100%)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            TENANT OVERVIEW
          </span>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff', marginTop: '4px' }}>
            Welcome back, {user?.name || 'User'}!
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Operating inside tenant <strong style={{ color: '#fff' }}>{activeTenant.name}</strong> ({activeTenant.slug}). All project and task data is strictly isolated.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <Link to="/projects" className="btn btn-primary">
            <Plus size={16} />
            <span>New Project</span>
          </Link>
          <Link to="/tasks" className="btn btn-secondary">
            <FolderKanban size={16} />
            <span>Kanban Board</span>
          </Link>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-muted)' }}>Projects</span>
            <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc' }}>
              <FolderKanban size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, marginTop: '12px', color: '#fff' }}>
            {loading ? <Loader2 size={24} className="spinner" /> : projects.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Isolated in active tenant</div>
        </div>

        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-muted)' }}>Tasks Loaded</span>
            <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.15)', color: '#93c5fd' }}>
              <ListTodo size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, marginTop: '12px', color: '#fff' }}>
            {loading ? <Loader2 size={24} className="spinner" /> : totalTasks}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Across all projects</div>
        </div>

        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-muted)' }}>Task Completion Rate</span>
            <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', color: '#6ee7b7' }}>
              <TrendingUp size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, marginTop: '12px', color: '#fff' }}>
            {loading ? <Loader2 size={24} className="spinner" /> : `${completionRate}%`}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>{doneTasks} of {totalTasks} finished</div>
        </div>

        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-muted)' }}>Organization Members</span>
            <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.15)', color: '#fcd34d' }}>
              <Users size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, marginTop: '12px', color: '#fff' }}>
            {loading ? <Loader2 size={24} className="spinner" /> : memberCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Collaborators in tenant</div>
        </div>
      </div>

      {/* Main Grid: Task Progress & Recent Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>
        {/* Recent Tasks */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>Recent Tasks</h3>
            <Link to="/tasks" style={{ fontSize: '0.825rem', color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              View All <ArrowRight size={14} />
            </Link>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '32px' }}><Loader2 size={28} className="spinner" /></div>
          ) : tasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
              No tasks found in active tenant. Create a task inside a project to get started.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {tasks.slice(0, 6).map((task) => (
                <div
                  key={task.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <StatusBadge status={task.status} />
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#fff' }}>{task.title}</div>
                      {task.project && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Project: {task.project.name}</div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <PriorityBadge priority={task.priority} />
                    {task.assignee && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}>
                        {task.assignee.name}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Status Breakdown sidebar card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Recent Activity card */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>Recent Activity</h3>
              <Link to="/activity" style={{ fontSize: '0.825rem', color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                View All <ArrowRight size={14} />
              </Link>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '16px' }}><Loader2 size={22} className="spinner" /></div>
            ) : activityError ? (
              <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>Couldn't load activity.</div>
            ) : activity.length === 0 ? (
              <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>No activity yet.</div>
            ) : (
              <ActivityFeed items={activity} compact />
            )}
          </div>

          <div className="glass-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginBottom: '16px' }}>
              Task Status Breakdown
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={14} color="var(--status-todo)" /> To Do
                  </span>
                  <span style={{ fontWeight: 600, color: '#fff' }}>{todoTasks}</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${totalTasks > 0 ? (todoTasks / totalTasks) * 100 : 0}%`, height: '100%', background: 'var(--status-todo)' }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={14} color="var(--status-in-progress)" /> In Progress
                  </span>
                  <span style={{ fontWeight: 600, color: '#fff' }}>{inProgressTasks}</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${totalTasks > 0 ? (inProgressTasks / totalTasks) * 100 : 0}%`, height: '100%', background: 'var(--status-in-progress)' }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={14} color="var(--status-done)" /> Completed
                  </span>
                  <span style={{ fontWeight: 600, color: '#fff' }}>{doneTasks}</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0}%`, height: '100%', background: 'var(--status-done)' }} />
                </div>
              </div>
            </div>
          </div>

          <div className="glass-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginBottom: '12px' }}>Recent Projects</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {projects.slice(0, 3).map((p) => (
                <Link
                  key={p.id}
                  to={`/projects/${p.id}`}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#fff' }}>{p.name}</div>
                    <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                      {p._count?.tasks ?? 0} tasks
                    </div>
                  </div>
                  <ArrowRight size={14} color="var(--text-secondary)" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
