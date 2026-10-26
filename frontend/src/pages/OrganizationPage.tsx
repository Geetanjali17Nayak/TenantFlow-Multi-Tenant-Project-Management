import React, { useEffect, useState } from 'react';
import { organizationsApi } from '../api/organizations';
import type { Membership, Role } from '../types';
import { useAuth } from '../context/AuthContext';
import { RoleBadge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import {
  Building2,
  UserPlus,
  Trash2,
  Loader2,
  Mail,
  CheckCircle,
} from 'lucide-react';

export const OrganizationPage: React.FC = () => {
  const { activeTenant, user, refreshOrganizations } = useAuth();

  const [members, setMembers] = useState<Membership[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Edit Org State
  const [orgName, setOrgName] = useState<string>('');
  const [orgSlug, setOrgSlug] = useState<string>('');
  const [isUpdatingOrg, setIsUpdatingOrg] = useState<boolean>(false);
  const [orgMessage, setOrgMessage] = useState<string | null>(null);

  // Add Member Modal
  const [isAddMemberOpen, setIsAddMemberOpen] = useState<boolean>(false);
  const [memberEmail, setMemberEmail] = useState<string>('');
  const [memberRole, setMemberRole] = useState<Role>('MEMBER');
  const [addLoading, setAddLoading] = useState<boolean>(false);
  const [addError, setAddError] = useState<string | null>(null);

  const isOwnerOrAdmin = activeTenant?.role === 'OWNER' || activeTenant?.role === 'ADMIN';

  const fetchOrgData = async () => {
    if (!activeTenant) return;
    setLoading(true);
    try {
      const [orgData, memberData] = await Promise.all([
        organizationsApi.getOrganizationById(activeTenant.id),
        organizationsApi.getMembers(activeTenant.id),
      ]);
      setOrgName(orgData.name);
      setOrgSlug(orgData.slug);
      setMembers(memberData);
    } catch (err) {
      console.error('Error fetching organization details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrgData();
  }, [activeTenant?.id]);

  const handleUpdateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant || !orgName.trim()) return;

    setIsUpdatingOrg(true);
    setOrgMessage(null);
    try {
      await organizationsApi.updateOrganization(activeTenant.id, {
        name: orgName.trim(),
        slug: orgSlug.trim() || undefined,
      });
      await refreshOrganizations();
      setOrgMessage('Organization details saved successfully!');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update organization details');
    } finally {
      setIsUpdatingOrg(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant || !memberEmail.trim()) return;

    setAddLoading(true);
    setAddError(null);
    try {
      await organizationsApi.addMember(activeTenant.id, memberEmail.trim(), memberRole);
      setIsAddMemberOpen(false);
      setMemberEmail('');
      setMemberRole('MEMBER');
      fetchOrgData();
    } catch (err: any) {
      setAddError(err.response?.data?.message || 'Failed to add member to organization');
    } finally {
      setAddLoading(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: Role) => {
    if (!activeTenant) return;
    try {
      await organizationsApi.updateMemberRole(activeTenant.id, memberId, newRole);
      fetchOrgData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update member role');
    }
  };

  const handleRemoveMember = async (memberId: string, memberEmailStr?: string) => {
    if (!activeTenant) return;
    if (!window.confirm(`Are you sure you want to remove ${memberEmailStr || 'this member'} from ${activeTenant.name}?`)) {
      return;
    }

    try {
      await organizationsApi.removeMember(activeTenant.id, memberId);
      fetchOrgData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to remove member');
    }
  };

  if (!activeTenant) {
    return <div style={{ padding: '32px', textAlign: 'center' }}>No Active Tenant Selected</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Page Title */}
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff' }}>Organization & Members</h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Manage tenant identity, settings, and member access roles for {activeTenant.name}
        </p>
      </div>

      {/* Organization Settings Card */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <Building2 size={22} color="var(--accent-primary)" />
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff' }}>Organization Profile</h2>
        </div>

        {orgMessage && <div className="alert-success">{orgMessage}</div>}

        <form onSubmit={handleUpdateOrg} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '16px', alignItems: 'end' }}>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Organization Name</label>
            <input
              type="text"
              className="input-field"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              disabled={!isOwnerOrAdmin}
              required
            />
          </div>

          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">URL Slug</label>
            <input
              type="text"
              className="input-field"
              value={orgSlug}
              onChange={(e) => setOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              disabled={!isOwnerOrAdmin}
              required
            />
          </div>

          {isOwnerOrAdmin && (
            <button type="submit" className="btn btn-secondary" disabled={isUpdatingOrg}>
              {isUpdatingOrg ? <Loader2 size={16} className="spinner" /> : <CheckCircle size={16} />}
              <span>Save Settings</span>
            </button>
          )}
        </form>
      </div>

      {/* Members Section */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff' }}>Organization Members</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {members.length} members with tenant-isolated RBAC permissions
            </p>
          </div>

          {isOwnerOrAdmin && (
            <button className="btn btn-primary" onClick={() => setIsAddMemberOpen(true)}>
              <UserPlus size={16} />
              <span>Add Member</span>
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px' }}>
            <Loader2 size={28} className="spinner" />
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Member Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Joined Date</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#fff' }}>
                        {m.user?.name ?? 'Unknown Member'}
                        {m.userId === user?.id && (
                          <span style={{ fontSize: '0.7rem', marginLeft: '6px', color: 'var(--accent-primary)', fontWeight: 700 }}>
                            (You)
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{m.user?.email}</td>
                    <td>
                      {isOwnerOrAdmin && m.userId !== user?.id && m.role !== 'OWNER' ? (
                        <select
                          value={m.role}
                          onChange={(e) => handleRoleChange(m.id, e.target.value as Role)}
                          style={{
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--border-color)',
                            color: '#fff',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                          }}
                        >
                          <option value="ADMIN">ADMIN</option>
                          <option value="MANAGER">MANAGER</option>
                          <option value="MEMBER">MEMBER</option>
                          <option value="VIEWER">VIEWER</option>
                        </select>
                      ) : (
                        <RoleBadge role={m.role} />
                      )}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {m.createdAt ? new Date(m.createdAt).toLocaleDateString() : '-'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {(isOwnerOrAdmin || m.userId === user?.id) && m.role !== 'OWNER' && (
                        <button
                          className="btn-icon"
                          onClick={() => handleRemoveMember(m.id, m.user?.email)}
                          title="Remove Member"
                        >
                          <Trash2 size={16} color="#fca5a5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Member Modal */}
      <Modal
        isOpen={isAddMemberOpen}
        onClose={() => setIsAddMemberOpen(false)}
        title={`Add Member to ${activeTenant.name}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsAddMemberOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleAddMember} disabled={addLoading || !memberEmail}>
              {addLoading ? <Loader2 size={16} className="spinner" /> : 'Add Member'}
            </button>
          </>
        }
      >
        {addError && <div className="alert-error">{addError}</div>}
        <form onSubmit={handleAddMember}>
          <div className="input-group">
            <label className="input-label">User Email Address</label>
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                className="input-field"
                placeholder="colleague@company.com"
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
                style={{ paddingLeft: '38px' }}
                required
              />
              <Mail size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Note: User must already be registered on the platform.
            </span>
          </div>

          <div className="input-group">
            <label className="input-label">Assigned Role</label>
            <select
              className="select-field"
              value={memberRole}
              onChange={(e) => setMemberRole(e.target.value as Role)}
            >
              <option value="ADMIN">ADMIN (Full management access)</option>
              <option value="MANAGER">MANAGER (Project & Task manage)</option>
              <option value="MEMBER">MEMBER (Standard edit access)</option>
              <option value="VIEWER">VIEWER (Read-only access)</option>
            </select>
          </div>
        </form>
      </Modal>
    </div>
  );
};
