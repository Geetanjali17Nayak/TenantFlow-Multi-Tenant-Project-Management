import React, { useState } from 'react';
import { organizationsApi } from '../../api/organizations';
import { useAuth } from '../../context/AuthContext';
import { Modal } from './Modal';
import { Loader2 } from 'lucide-react';

interface CreateOrganizationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateOrganizationModal: React.FC<CreateOrganizationModalProps> = ({ isOpen, onClose }) => {
  const { refreshOrganizations, switchTenant } = useAuth();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    // Auto generate slug
    setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const newOrg = await organizationsApi.createOrganization(name.trim(), slug.trim());
      await refreshOrganizations();
      await switchTenant(newOrg.id);
      setName('');
      setSlug('');
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create organization');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Organization"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading || !name || !slug}>
            {loading ? <Loader2 size={16} className="spinner" /> : 'Create Tenant'}
          </button>
        </>
      }
    >
      {error && <div className="alert-error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <label className="input-label">Organization Name</label>
          <input
            type="text"
            className="input-field"
            placeholder="Acme Corp"
            value={name}
            onChange={handleNameChange}
            required
          />
        </div>

        <div className="input-group">
          <label className="input-label">URL Identifier (Slug)</label>
          <input
            type="text"
            className="input-field"
            placeholder="acme-corp"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            required
          />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Unique slug for tenant routing: /org/{slug || 'acme-corp'}
          </span>
        </div>
      </form>
    </Modal>
  );
};
