import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { projectsApi } from '../api/projects';
import type { Project } from '../types';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/common/Modal';
import {
  FolderKanban,
  Plus,
  Search,
  Trash2,
  Edit2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Calendar,
  Layers,
} from 'lucide-react';

export const ProjectsPage: React.FC = () => {
  const { activeTenant } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [isEditOpen, setIsEditOpen] = useState<boolean>(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const [formName, setFormName] = useState<string>('');
  const [formDesc, setFormDesc] = useState<string>('');
  const [submitLoading, setSubmitLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await projectsApi.getProjects({ page, limit: 9, search });
      setProjects(res.data);
      setTotalPages(res.totalPages || 1);
      setTotal(res.total || 0);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [activeTenant?.id, page, search]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    setSubmitLoading(true);
    setError(null);
    try {
      await projectsApi.createProject({ name: formName.trim(), description: formDesc.trim() || undefined });
      setFormName('');
      setFormDesc('');
      setIsCreateOpen(false);
      fetchProjects();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create project');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !formName.trim()) return;

    setSubmitLoading(true);
    setError(null);
    try {
      await projectsApi.updateProject(selectedProject.id, {
        name: formName.trim(),
        description: formDesc.trim() || undefined,
      });
      setIsEditOpen(false);
      setSelectedProject(null);
      fetchProjects();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update project');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete project "${name}"? All associated tasks will be removed.`)) {
      return;
    }

    try {
      await projectsApi.deleteProject(id);
      fetchProjects();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete project');
    }
  };

  const openEditModal = (proj: Project) => {
    setSelectedProject(proj);
    setFormName(proj.name);
    setFormDesc(proj.description || '');
    setError(null);
    setIsEditOpen(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff' }}>Projects</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Manage and track software projects in {activeTenant?.name ?? 'active tenant'} ({total} total)
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => {
            setFormName('');
            setFormDesc('');
            setError(null);
            setIsCreateOpen(true);
          }}
        >
          <Plus size={16} />
          <span>New Project</span>
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
          <input
            type="text"
            className="input-field"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            style={{ paddingLeft: '38px' }}
          />
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
        </div>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '64px' }}>
          <Loader2 size={36} className="spinner" />
        </div>
      ) : projects.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '64px 20px' }}>
          <FolderKanban size={48} color="var(--text-muted)" style={{ marginBottom: '12px' }} />
          <h3 style={{ fontSize: '1.15rem', color: '#fff' }}>No Projects Found</h3>
          <p style={{ color: 'var(--text-muted)', marginTop: '4px', maxWidth: '360px', margin: '4px auto 20px' }}>
            {search ? 'No projects match your search criteria.' : 'Create your first project to organize tasks.'}
          </p>
          <button
            className="btn btn-primary"
            onClick={() => {
              setFormName('');
              setFormDesc('');
              setIsCreateOpen(true);
            }}
          >
            <Plus size={16} />
            <span>Create Project</span>
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {projects.map((project) => (
            <div
              key={project.id}
              className="glass-card"
              style={{
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                  <Link
                    to={`/projects/${project.id}`}
                    style={{
                      fontSize: '1.15rem',
                      fontWeight: 700,
                      color: '#fff',
                      textDecoration: 'none',
                      lineHeight: 1.3,
                    }}
                  >
                    {project.name}
                  </Link>

                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button className="btn-icon" onClick={() => openEditModal(project)} title="Edit Project">
                      <Edit2 size={16} />
                    </button>
                    <button
                      className="btn-icon"
                      onClick={() => handleDelete(project.id, project.name)}
                      title="Delete Project"
                    >
                      <Trash2 size={16} color="#fca5a5" />
                    </button>
                  </div>
                </div>

                <p
                  style={{
                    fontSize: '0.85rem',
                    color: 'var(--text-secondary)',
                    marginTop: '8px',
                    lineHeight: 1.4,
                    minHeight: '40px',
                  }}
                >
                  {project.description || 'No description provided.'}
                </p>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderTop: '1px solid var(--border-color)',
                  marginTop: '16px',
                  paddingTop: '16px',
                  fontSize: '0.775rem',
                  color: 'var(--text-muted)',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Layers size={14} color="var(--accent-primary)" />
                  {project._count?.tasks ?? 0} Tasks
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={14} />
                  {new Date(project.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginTop: '16px' }}>
          <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft size={16} />
            <span>Previous</span>
          </button>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Page {page} of {totalPages}
          </span>
          <button className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            <span>Next</span>
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Create Project Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Project"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleCreateSubmit} disabled={submitLoading || !formName}>
              {submitLoading ? <Loader2 size={16} className="spinner" /> : 'Create Project'}
            </button>
          </>
        }
      >
        {error && <div className="alert-error">{error}</div>}
        <form onSubmit={handleCreateSubmit}>
          <div className="input-group">
            <label className="input-label">Project Name</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Mobile Application v2.0"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
            />
          </div>
          <div className="input-group">
            <label className="input-label">Description (Optional)</label>
            <textarea
              className="textarea-field"
              placeholder="Provide context and goals for this project..."
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
            />
          </div>
        </form>
      </Modal>

      {/* Edit Project Modal */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Edit Project"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsEditOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleEditSubmit} disabled={submitLoading || !formName}>
              {submitLoading ? <Loader2 size={16} className="spinner" /> : 'Save Changes'}
            </button>
          </>
        }
      >
        {error && <div className="alert-error">{error}</div>}
        <form onSubmit={handleEditSubmit}>
          <div className="input-group">
            <label className="input-label">Project Name</label>
            <input
              type="text"
              className="input-field"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
            />
          </div>
          <div className="input-group">
            <label className="input-label">Description</label>
            <textarea
              className="textarea-field"
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};
