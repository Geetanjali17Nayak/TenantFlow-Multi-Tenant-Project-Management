import React, { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { CreateOrganizationModal } from '../common/CreateOrganizationModal';
import { RoleBadge } from '../common/Badge';
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Users,
  ShieldAlert,
  Plus,
  LogOut,
  ChevronDown,
  Building2,
  Menu,
  X,
  User as UserIcon,
} from 'lucide-react';

export const AppLayout: React.FC = () => {
  const { user, organizations, activeTenant, switchTenant, logout } = useAuth();
  const navigate = useNavigate();

  const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false);
  const [isCreateOrgOpen, setIsCreateOrgOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  const handleTenantSelect = async (orgId: string) => {
    if (activeTenant?.id === orgId) {
      setIsOrgDropdownOpen(false);
      return;
    }

    setSwitching(true);
    try {
      await switchTenant(orgId);
      setIsOrgDropdownOpen(false);
    } catch (e) {
      console.error('Error switching tenant:', e);
    } finally {
      setSwitching(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/projects', label: 'Projects', icon: FolderKanban },
    { to: '/tasks', label: 'Tasks Kanban', icon: CheckSquare },
    { to: '/organization', label: 'Members & Roles', icon: Users },
    { to: '/audit-logs', label: 'Audit Trail', icon: ShieldAlert },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Top Header */}
      <header
        style={{
          height: '64px',
          borderBottom: '1px solid var(--border-color)',
          background: 'rgba(17, 24, 39, 0.85)',
          backdropFilter: 'blur(12px)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            className="btn-icon"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            style={{ display: 'none' }} // can toggle on smaller screens via css media query if needed
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'var(--accent-gradient)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--shadow-glow)',
              }}
            >
              <Building2 size={20} color="#fff" />
            </div>
            <div>
              <span
                style={{
                  fontSize: '1.15rem',
                  fontWeight: 800,
                  background: 'var(--accent-gradient)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  letterSpacing: '-0.02em',
                }}
              >
                TenantFlow
              </span>
              <span
                style={{
                  fontSize: '0.65rem',
                  display: 'block',
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                  marginTop: '-3px',
                }}
              >
                MULTI-TENANT SAAS
              </span>
            </div>
          </Link>
        </div>

        {/* Tenant Switcher + Profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Active Tenant Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setIsOrgDropdownOpen(!isOrgDropdownOpen)}
              disabled={switching}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '6px 14px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <Building2 size={16} color="var(--accent-primary)" />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, lineHeight: 1.2 }}>
                  {activeTenant ? activeTenant.name : 'Select Organization'}
                </div>
                {activeTenant && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Role: <span style={{ color: '#a5b4fc', fontWeight: 600 }}>{activeTenant.role}</span>
                  </div>
                )}
              </div>
              <ChevronDown size={14} color="var(--text-secondary)" />
            </button>

            {isOrgDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  width: '260px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-lg)',
                  padding: '8px',
                  zIndex: 200,
                  animation: 'slideUp 0.15s ease-out',
                }}
              >
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', padding: '6px 10px' }}>
                  YOUR ORGANIZATIONS
                </div>

                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {organizations.map((org) => (
                    <div
                      key={org.id}
                      onClick={() => handleTenantSelect(org.id)}
                      style={{
                        padding: '10px',
                        borderRadius: 'var(--radius-sm)',
                        background: activeTenant?.id === org.id ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                        border: activeTenant?.id === org.id ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '4px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {org.name}
                        </div>
                        <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>/{org.slug}</div>
                      </div>
                      <RoleBadge role={org.role} />
                    </div>
                  ))}
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '6px', paddingTop: '6px' }}>
                  <button
                    className="btn btn-outline btn-sm"
                    style={{ width: '100%', justifyContent: 'flex-start' }}
                    onClick={() => {
                      setIsOrgDropdownOpen(false);
                      setIsCreateOrgOpen(true);
                    }}
                  >
                    <Plus size={14} />
                    <span>Create New Organization</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* User Profile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderLeft: '1px solid var(--border-color)', paddingLeft: '16px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-primary)',
                fontWeight: 700,
              }}
            >
              {user?.name ? user.name.charAt(0).toUpperCase() : <UserIcon size={16} />}
            </div>
            <div style={{ display: 'none', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{user?.name}</span>
              <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>{user?.email}</span>
            </div>

            <button className="btn-icon" onClick={handleLogout} title="Sign Out">
              <LogOut size={18} color="#fca5a5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <div style={{ display: 'flex', flex: 1 }}>
        {/* Sidebar */}
        <aside
          style={{
            width: '240px',
            borderRight: '1px solid var(--border-color)',
            background: 'var(--bg-secondary)',
            padding: '24px 16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: '8px', paddingLeft: '12px' }}>
              MAIN NAVIGATION
            </div>

            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  style={({ isActive }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    textDecoration: 'none',
                    color: isActive ? '#ffffff' : 'var(--text-secondary)',
                    background: isActive ? 'var(--accent-gradient)' : 'transparent',
                    boxShadow: isActive ? '0 4px 12px rgba(99, 102, 241, 0.3)' : 'none',
                    transition: 'all 0.2s ease',
                  })}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>

          {/* Active Tenant Box in Sidebar */}
          {activeTenant && (
            <div
              className="glass-card"
              style={{
                padding: '14px',
                marginTop: 'auto',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                background: 'rgba(99, 102, 241, 0.05)',
              }}
            >
              <div style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--accent-primary)', marginBottom: '4px' }}>
                ACTIVE ISOLATED TENANT
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff' }}>{activeTenant.name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {activeTenant.id.substring(0, 13)}...</div>
            </div>
          )}
        </aside>

        {/* Content Area */}
        <main style={{ flex: 1, padding: '32px', maxWidth: '1400px', width: '100%', margin: '0 auto' }}>
          <Outlet />
        </main>
      </div>

      {/* Modal for Creating Organization */}
      <CreateOrganizationModal isOpen={isCreateOrgOpen} onClose={() => setIsCreateOrgOpen(false)} />
    </div>
  );
};
