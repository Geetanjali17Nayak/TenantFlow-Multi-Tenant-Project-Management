import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { usersApi } from '../api/users';
import type { User, UserOrgMembership } from '../types';
import { getApiErrorMessages } from '../utils/apiError';
import { Avatar } from '../components/common/Avatar';
import { RoleBadge } from '../components/common/Badge';
import { CreateOrganizationModal } from '../components/common/CreateOrganizationModal';
import { UserCircle, KeyRound, Building2, Loader2, CheckCircle, Plus, ArrowRightLeft } from 'lucide-react';

const NAME_MAX = 100;
const AVATAR_URL_MAX = 2048;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72;
const SUCCESS_TIMEOUT_MS = 4000;

const formatDate = (value?: string, options?: Intl.DateTimeFormatOptions) =>
  value ? new Date(value).toLocaleDateString(undefined, options ?? { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const isValidHttpsUrl = (value: string) => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

// Clears a success message after a few seconds
const useAutoClear = (message: string | null, setMessage: (value: string | null) => void) => {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), SUCCESS_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [message, setMessage]);
};

const ErrorList: React.FC<{ errors: string[] }> = ({ errors }) =>
  errors.length === 0 ? null : (
    <div className="alert-error" role="alert">
      {errors.length === 1 ? (
        errors[0]
      ) : (
        <ul style={{ margin: 0, paddingLeft: '18px' }}>
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );

/* ---------- Profile details ---------- */

interface ProfileDetailsFormProps {
  user: User;
  onSaved: () => Promise<void>;
}

const ProfileDetailsForm: React.FC<ProfileDetailsFormProps> = ({ user, onSaved }) => {
  const [name, setName] = useState(user.name);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? '');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  useAutoClear(message, setMessage);

  const trimmedName = name.trim();
  const normalizedAvatar = avatarUrl.trim() || null;
  const nameChanged = trimmedName !== user.name;
  const avatarChanged = normalizedAvatar !== (user.avatarUrl ?? null);
  const dirty = nameChanged || avatarChanged;
  const avatarPreviewValid = !!normalizedAvatar && isValidHttpsUrl(normalizedAvatar);

  const validate = (): string[] => {
    const errs: string[] = [];
    if (!trimmedName) errs.push('Name cannot be empty');
    if (trimmedName.length > NAME_MAX) errs.push(`Name must be at most ${NAME_MAX} characters`);
    if (normalizedAvatar) {
      if (!isValidHttpsUrl(normalizedAvatar)) errs.push('Avatar must be an https:// URL');
      if (normalizedAvatar.length > AVATAR_URL_MAX) errs.push(`Avatar URL must be at most ${AVATAR_URL_MAX} characters`);
    }
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const errs = validate();
    setErrors(errs);
    if (errs.length > 0 || !dirty) return;

    setSaving(true);
    try {
      await usersApi.updateProfile({
        ...(nameChanged && { name: trimmedName }),
        ...(avatarChanged && { avatarUrl: normalizedAvatar }),
      });
      await onSaved();
      setName(trimmedName);
      setAvatarUrl(normalizedAvatar ?? '');
      setMessage('Profile updated');
    } catch (err) {
      setErrors(getApiErrorMessages(err, 'Failed to update profile'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setName(user.name);
    setAvatarUrl(user.avatarUrl ?? '');
    setErrors([]);
  };

  return (
    <div className="glass-card" style={{ padding: '24px' }}>
      <div className="profile-section-title">
        <UserCircle size={22} color="var(--accent-primary)" />
        <h2>Profile details</h2>
      </div>

      {message && <div className="alert-success" role="status">{message}</div>}
      <ErrorList errors={errors} />

      <form onSubmit={handleSubmit} noValidate>
        <div className="input-group">
          <label className="input-label" htmlFor="profile-name">Name</label>
          <input
            id="profile-name"
            type="text"
            className="input-field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={NAME_MAX + 20}
            autoComplete="name"
            required
          />
        </div>

        <div className="input-group">
          <label className="input-label" htmlFor="profile-avatar">Avatar URL</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input
              id="profile-avatar"
              type="url"
              className="input-field"
              placeholder="https://example.com/avatar.png"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              aria-describedby="profile-avatar-hint"
            />
            {avatarPreviewValid && <Avatar name={trimmedName} avatarUrl={normalizedAvatar} size={40} />}
          </div>
          <span id="profile-avatar-hint" className="profile-hint">
            Link to an https:// image. Leave empty to use your initial.
          </span>
        </div>

        <div className="input-group">
          <span className="input-label">Email</span>
          <span className="profile-readonly">{user.email}</span>
        </div>

        <div className="profile-actions">
          <button type="button" className="btn btn-outline" onClick={handleCancel} disabled={!dirty || saving}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!dirty || saving}>
            {saving ? <Loader2 size={16} className="spinner" /> : <CheckCircle size={16} />}
            <span>Save changes</span>
          </button>
        </div>
      </form>
    </div>
  );
};

/* ---------- Change password ---------- */

const ChangePasswordForm: React.FC = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  useAutoClear(message, setMessage);

  const validate = (): string[] => {
    const errs: string[] = [];
    if (!currentPassword) errs.push('Current password is required');
    if (newPassword.length < PASSWORD_MIN) errs.push(`Password must be at least ${PASSWORD_MIN} characters long`);
    if (newPassword.length > PASSWORD_MAX) errs.push(`Password must be at most ${PASSWORD_MAX} characters long`);
    if (currentPassword && newPassword && currentPassword === newPassword) {
      errs.push('New password must be different from the current password');
    }
    if (newPassword !== confirmPassword) errs.push('Passwords do not match');
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const errs = validate();
    setErrors(errs);
    if (errs.length > 0) return;

    setSaving(true);
    try {
      await usersApi.changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage('Password updated');
    } catch (err) {
      setErrors(getApiErrorMessages(err, 'Failed to update password'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass-card" style={{ padding: '24px' }}>
      <div className="profile-section-title">
        <KeyRound size={22} color="var(--accent-primary)" />
        <h2>Change password</h2>
      </div>

      {message && <div className="alert-success" role="status">{message}</div>}
      <ErrorList errors={errors} />

      <form onSubmit={handleSubmit} noValidate>
        <div className="input-group">
          <label className="input-label" htmlFor="current-password">Current password</label>
          <input
            id="current-password"
            type="password"
            className="input-field"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        <div className="input-group">
          <label className="input-label" htmlFor="new-password">New password</label>
          <input
            id="new-password"
            type="password"
            className="input-field"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            aria-describedby="new-password-hint"
            required
          />
          <span id="new-password-hint" className="profile-hint">
            {PASSWORD_MIN}–{PASSWORD_MAX} characters.
          </span>
        </div>

        <div className="input-group">
          <label className="input-label" htmlFor="confirm-password">Confirm new password</label>
          <input
            id="confirm-password"
            type="password"
            className="input-field"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>

        <div className="profile-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <Loader2 size={16} className="spinner" /> : <KeyRound size={16} />}
            <span>Update password</span>
          </button>
        </div>
      </form>
    </div>
  );
};

/* ---------- Organizations ---------- */

interface OrganizationsListProps {
  organizations: UserOrgMembership[];
  activeTenantId?: string;
  onSwitch: (orgId: string) => Promise<void>;
}

const OrganizationsList: React.FC<OrganizationsListProps> = ({ organizations, activeTenantId, onSwitch }) => {
  const [switchingOrgId, setSwitchingOrgId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreateOrgOpen, setIsCreateOrgOpen] = useState(false);

  const handleSwitch = async (orgId: string) => {
    setError(null);
    setSwitchingOrgId(orgId);
    try {
      await onSwitch(orgId);
    } catch (err) {
      setError(getApiErrorMessages(err, 'Failed to switch organization')[0]);
    } finally {
      setSwitchingOrgId(null);
    }
  };

  return (
    <div className="glass-card" style={{ padding: '24px' }}>
      <div className="profile-section-title">
        <Building2 size={22} color="var(--accent-primary)" />
        <h2>Your organizations</h2>
      </div>

      {error && <div className="alert-error" role="alert">{error}</div>}

      {organizations.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
          <p style={{ marginBottom: '16px' }}>You're not a member of any organization yet.</p>
          <button className="btn btn-primary" onClick={() => setIsCreateOrgOpen(true)}>
            <Plus size={16} />
            <span>Create organization</span>
          </button>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                <th>Role</th>
                <th>Joined</th>
                <th aria-label="Action" />
              </tr>
            </thead>
            <tbody>
              {organizations.map((org) => {
                const isActive = org.id === activeTenantId;
                return (
                  <tr key={org.id}>
                    <td style={{ fontWeight: 600 }}>{org.name}</td>
                    <td style={{ color: 'var(--text-muted)' }}>/{org.slug}</td>
                    <td>
                      <RoleBadge role={org.role} />
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{formatDate(org.joinedAt)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {isActive ? (
                        <span className="profile-active-label">Active</span>
                      ) : (
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => handleSwitch(org.id)}
                          disabled={switchingOrgId !== null}
                          aria-label={`Switch to ${org.name}`}
                        >
                          {switchingOrgId === org.id ? (
                            <Loader2 size={14} className="spinner" />
                          ) : (
                            <ArrowRightLeft size={14} />
                          )}
                          <span>Switch</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <CreateOrganizationModal isOpen={isCreateOrgOpen} onClose={() => setIsCreateOrgOpen(false)} />
    </div>
  );
};

/* ---------- Page ---------- */

export const ProfilePage: React.FC = () => {
  const { user, organizations, activeTenant, switchTenant, refreshProfile } = useAuth();

  // ProtectedRoute guarantees a user; this only satisfies the type checker
  if (!user) return null;

  return (
    <div className="profile-grid">
      <div className="profile-header">
        <Avatar name={user.name} avatarUrl={user.avatarUrl} size={72} />
        <div style={{ minWidth: 0 }}>
          <h1 className="profile-name">{user.name}</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            {user.email} · Joined {formatDate(user.createdAt, { month: 'short', year: 'numeric' })}
          </p>
        </div>
      </div>

      <ProfileDetailsForm user={user} onSaved={refreshProfile} />
      <ChangePasswordForm />
      <OrganizationsList organizations={organizations} activeTenantId={activeTenant?.id} onSwitch={switchTenant} />
    </div>
  );
};
