import React, { useEffect, useState } from 'react';
import { auditApi } from '../api/audit';
import type { AuditQueryParams } from '../api/audit';
import type { AuditLog } from '../types';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/common/Modal';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Code,
  Calendar,
  User,
} from 'lucide-react';

export const AuditLogsPage: React.FC = () => {
  const { activeTenant } = useAuth();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);

  // Filters
  const [actionFilter, setActionFilter] = useState<string>('');
  const [entityFilter, setEntityFilter] = useState<string>('');

  // Selected Log for metadata viewer modal
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchLogs = async () => {
    if (!activeTenant) return;
    setLoading(true);
    try {
      const params: AuditQueryParams = {
        page,
        limit: 15,
        action: actionFilter || undefined,
        entity: entityFilter || undefined,
      };
      const res = await auditApi.getAuditLogs(params);
      setLogs(res.data);
      setTotalPages(res.meta.totalPages || 1);
      setTotal(res.meta.total || 0);
    } catch (err: any) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [activeTenant?.id, page, actionFilter, entityFilter]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Title */}
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff' }}>Audit Trail & Security Logs</h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Immutable activity trail for security, governance, and audit compliance in {activeTenant?.name} ({total} logs)
        </p>
      </div>

      {/* Filter Bar */}
      <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', gap: '16px', alignItems: 'center' }}>
        <div style={{ flex: 1, maxWidth: '280px' }}>
          <input
            type="text"
            className="input-field"
            placeholder="Filter by Action (e.g. PROJECT_CREATED)"
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div style={{ flex: 1, maxWidth: '280px' }}>
          <input
            type="text"
            className="input-field"
            placeholder="Filter by Entity (e.g. Project)"
            value={entityFilter}
            onChange={(e) => {
              setEntityFilter(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {/* Audit Log Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '64px' }}>
          <Loader2 size={36} className="spinner" />
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor User</th>
                <th>Action</th>
                <th>Entity Target</th>
                <th>Entity ID</th>
                <th style={{ textAlign: 'right' }}>Metadata</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                    No audit logs recorded for this criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={14} />
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                    </td>
                    <td>
                      {log.user ? (
                        <span style={{ fontSize: '0.825rem', color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <User size={14} color="var(--accent-primary)" />
                          {log.user.name || log.user.email}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>System / Anonymous</span>
                      )}
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '4px',
                          background: 'rgba(99, 102, 241, 0.15)',
                          color: '#a5b4fc',
                          border: '1px solid rgba(99, 102, 241, 0.3)',
                        }}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {log.entity}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                      {log.entityId.substring(0, 16)}...
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {log.metadata ? (
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => setSelectedLog(log)}
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                        >
                          <Code size={13} />
                          <span>View Details</span>
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Controls */}
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

      {/* JSON Metadata Viewer Modal */}
      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title={`Audit Entry: ${selectedLog?.action ?? ''}`}
        footer={
          <button className="btn btn-secondary" onClick={() => setSelectedLog(null)}>
            Close
          </button>
        }
      >
        {selectedLog && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
              <strong>Entity ID:</strong> {selectedLog.entityId}
            </div>
            <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
              <strong>Timestamp:</strong> {new Date(selectedLog.createdAt).toISOString()}
            </div>
            <div className="input-label" style={{ marginTop: '8px' }}>Metadata Payload JSON:</div>
            <pre
              style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                padding: '16px',
                color: '#6ee7b7',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8rem',
                overflowX: 'auto',
                maxHeight: '300px',
              }}
            >
              {JSON.stringify(selectedLog.metadata, null, 2)}
            </pre>
          </div>
        )}
      </Modal>
    </div>
  );
};
