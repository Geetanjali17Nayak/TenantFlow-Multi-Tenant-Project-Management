import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { activityApi } from '../api/activity';
import type { ActivityQueryParams } from '../api/activity';
import { organizationsApi } from '../api/organizations';
import type { ActivityEntity, ActivityItem, Membership } from '../types';
import { useAuth } from '../context/AuthContext';
import { ActivityFeed } from '../components/activity/ActivityFeed';
import { getApiErrorMessages } from '../utils/apiError';
import { Activity, Building2, ChevronLeft, ChevronRight, Loader2, RefreshCw, X } from 'lucide-react';

const PAGE_SIZE = 20;

const ENTITY_OPTIONS: { value: '' | ActivityEntity; label: string }[] = [
  { value: '', label: 'All types' },
  { value: 'Task', label: 'Tasks' },
  { value: 'Project', label: 'Projects' },
  { value: 'Member', label: 'Members' },
];

// <input type="date"> gives a local calendar day; send its start/end as UTC instants
const startOfLocalDay = (day: string) => new Date(`${day}T00:00:00`).toISOString();
const endOfLocalDay = (day: string) => new Date(`${day}T23:59:59.999`).toISOString();

export const ActivityPage: React.FC = () => {
  const { activeTenant } = useAuth();
  const activeTenantId = activeTenant?.id;
  const [searchParams, setSearchParams] = useSearchParams();

  // Entity filters live in the URL so task/project "History" links can deep-link here
  const entityFilter = (searchParams.get('entity') || '') as '' | ActivityEntity;
  const entityId = searchParams.get('entityId') || '';

  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [hasLoaded, setHasLoaded] = useState<boolean>(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);
  const [reloadKey, setReloadKey] = useState<number>(0);

  const [actorFilter, setActorFilter] = useState<string>('');
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [members, setMembers] = useState<Membership[]>([]);

  // Members and actor filter are per tenant: reset them when the active tenant changes
  const [tenantId, setTenantId] = useState<string | undefined>(activeTenantId);
  if (activeTenantId !== tenantId) {
    setTenantId(activeTenantId);
    setPage(1);
    setActorFilter('');
    setMembers([]);
  }

  const dateRangeInvalid = !!from && !!to && from > to;
  const hasFilters = !!entityFilter || !!entityId || !!actorFilter || !!from || !!to;

  useEffect(() => {
    if (!activeTenantId) return;
    let cancelled = false;

    organizationsApi
      .getMembers(activeTenantId)
      .then((res) => {
        if (!cancelled) setMembers(res);
      })
      .catch(() => {
        // The actor dropdown is optional; without members it just isn't shown
      });

    return () => {
      cancelled = true;
    };
  }, [activeTenantId]);

  useEffect(() => {
    if (!activeTenantId || dateRangeInvalid) return;
    let cancelled = false;

    const params: ActivityQueryParams = {
      page,
      limit: PAGE_SIZE,
      entity: entityFilter || undefined,
      entityId: entityId || undefined,
      actorId: actorFilter || undefined,
      from: from ? startOfLocalDay(from) : undefined,
      to: to ? endOfLocalDay(to) : undefined,
    };

    const load = async () => {
      setLoading(true);
      try {
        const res = await activityApi.getActivity(params);
        if (cancelled) return;
        setItems(res.data);
        setTotalPages(res.meta.totalPages || 1);
        setTotal(res.meta.total || 0);
        setErrors([]);
      } catch (err: any) {
        if (cancelled) return;
        setErrors(
          err?.response?.status === 403
            ? ["You no longer have access to this organization's activity."]
            : getApiErrorMessages(err, 'Failed to load activity'),
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
          setHasLoaded(true);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [activeTenantId, page, entityFilter, entityId, actorFilter, from, to, dateRangeInvalid, reloadKey]);

  const updateEntityFilter = (value: '' | ActivityEntity) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set('entity', value);
    else next.delete('entity');
    next.delete('entityId');
    setSearchParams(next);
    setPage(1);
  };

  const clearHistory = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('entity');
    next.delete('entityId');
    setSearchParams(next);
    setPage(1);
  };

  const clearFilters = () => {
    setSearchParams(new URLSearchParams());
    setActorFilter('');
    setFrom('');
    setTo('');
    setPage(1);
  };

  if (!activeTenant) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 20px', color: 'var(--text-muted)' }}>
        <Building2 size={32} color="var(--accent-primary)" />
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', marginTop: '12px' }}>No Active Organization</h2>
        <p style={{ marginTop: '8px' }}>Select or create an organization to see its activity.</p>
      </div>
    );
  }

  const historyName = entityId
    ? items[0]?.metadata?.title || items[0]?.metadata?.name || items[0]?.metadata?.memberName
    : undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Activity size={24} color="var(--accent-primary)" />
            Activity
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Everything that changed in {activeTenant.name} ({total} {total === 1 ? 'event' : 'events'})
          </p>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setReloadKey((k) => k + 1)}
          disabled={loading}
          aria-label="Refresh activity"
        >
          {loading && hasLoaded ? <Loader2 size={16} className="spinner" /> : <RefreshCw size={16} />}
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="glass-card activity-filters">
        <select
          className="input-field"
          aria-label="Filter by type"
          value={entityFilter}
          onChange={(e) => updateEntityFilter(e.target.value as '' | ActivityEntity)}
        >
          {ENTITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {members.length > 0 && (
          <select
            className="input-field"
            aria-label="Filter by person"
            value={actorFilter}
            onChange={(e) => {
              setActorFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Anyone</option>
            {members
              .filter((m) => m.user)
              .map((m) => (
                <option key={m.user!.id} value={m.user!.id}>
                  {m.user!.name || m.user!.email}
                </option>
              ))}
          </select>
        )}

        <label className="activity-date">
          <span>From</span>
          <input
            type="date"
            className="input-field"
            value={from}
            max={to || undefined}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
          />
        </label>

        <label className="activity-date">
          <span>To</span>
          <input
            type="date"
            className="input-field"
            value={to}
            min={from || undefined}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
          />
        </label>

        {hasFilters && (
          <button className="btn btn-outline btn-sm" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>

      {entityId && (
        <div>
          <span className="activity-chip">
            History of {historyName ? `“${historyName}”` : `this ${entityFilter ? entityFilter.toLowerCase() : 'item'}`}
            <button onClick={clearHistory} aria-label="Show all activity">
              <X size={14} />
            </button>
          </span>
        </div>
      )}

      {dateRangeInvalid && <div className="alert-error">The “From” date must be on or before the “To” date.</div>}

      {errors.length > 0 && !dateRangeInvalid && (
        <div className="alert-error" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            {errors.map((msg) => (
              <div key={msg}>{msg}</div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {hasFilters && (
              <button className="btn btn-outline btn-sm" onClick={clearFilters}>
                Clear filters
              </button>
            )}
            <button className="btn btn-secondary btn-sm" onClick={() => setReloadKey((k) => k + 1)}>
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Feed */}
      {loading && !hasLoaded ? (
        <div style={{ textAlign: 'center', padding: '64px' }}>
          <Loader2 size={36} className="spinner" />
        </div>
      ) : errors.length === 0 && !dateRangeInvalid && items.length === 0 ? (
        <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          {hasFilters ? (
            <>
              <p>No activity matches these filters.</p>
              <button className="btn btn-outline btn-sm" style={{ marginTop: '12px' }} onClick={clearFilters}>
                Clear filters
              </button>
            </>
          ) : (
            <p>No activity yet. Changes to projects, tasks and members will show up here.</p>
          )}
        </div>
      ) : items.length > 0 ? (
        <div className="glass-card" style={{ padding: '8px 20px', opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s ease' }}>
          <ActivityFeed items={items} groupByDay />
        </div>
      ) : null}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
          <button className="btn btn-secondary btn-sm" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>
            <ChevronLeft size={16} /> Previous
          </button>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Page {page} of {totalPages}
          </span>
          <button
            className="btn btn-secondary btn-sm"
            disabled={page >= totalPages || loading}
            onClick={() => setPage(page + 1)}
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
};
