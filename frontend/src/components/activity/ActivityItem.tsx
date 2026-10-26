import React from 'react';
import { Link } from 'react-router-dom';
import type { ActivityItem as ActivityItemType } from '../../types';
import { Avatar } from '../common/Avatar';
import { formatActivity } from './formatActivity';
import { formatRelativeTime } from './relativeTime';

interface ActivityItemProps {
  item: ActivityItemType;
  compact?: boolean;
}

export const ActivityItem: React.FC<ActivityItemProps> = ({ item, compact = false }) => {
  const formatted = formatActivity(item);
  const actorName = item.actor ? item.actor.name || item.actor.email : 'Deleted user';
  const sentence = [formatted.before, formatted.target && `“${formatted.target}”`, formatted.after]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={`activity-item${compact ? ' activity-item-compact' : ''}`}>
      <Avatar name={item.actor?.name} avatarUrl={item.actor?.avatarUrl} size={compact ? 28 : 34} />

      <div className="activity-item-body">
        <div className="activity-item-text" title={`${actorName} ${sentence}`}>
          <strong>{actorName}</strong> {formatted.before}{' '}
          {formatted.target &&
            (formatted.href ? (
              <Link to={formatted.href} className="activity-target">
                “{formatted.target}”
              </Link>
            ) : (
              <span className="activity-target">“{formatted.target}”</span>
            ))}{' '}
          {formatted.after}
        </div>
        {formatted.detail && <div className="activity-item-detail">{formatted.detail}</div>}
      </div>

      <time className="activity-time" dateTime={item.createdAt} title={new Date(item.createdAt).toLocaleString()}>
        {formatRelativeTime(item.createdAt)}
      </time>
    </div>
  );
};
