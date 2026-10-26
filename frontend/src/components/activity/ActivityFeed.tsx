import React from 'react';
import type { ActivityItem as ActivityItemType } from '../../types';
import { ActivityItem } from './ActivityItem';
import { dayLabel } from './relativeTime';

interface ActivityFeedProps {
  items: ActivityItemType[];
  groupByDay?: boolean;
  compact?: boolean;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ items, groupByDay = false, compact = false }) => {
  if (!groupByDay) {
    return (
      <div className="activity-feed">
        {items.map((item) => (
          <ActivityItem key={item.id} item={item} compact={compact} />
        ))}
      </div>
    );
  }

  // Items arrive newest first, so consecutive grouping keeps days in order
  const groups: { label: string; items: ActivityItemType[] }[] = [];
  for (const item of items) {
    const label = dayLabel(item.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.items.push(item);
    } else {
      groups.push({ label, items: [item] });
    }
  }

  return (
    <div className="activity-feed">
      {groups.map((group) => (
        <section key={group.label}>
          <h4 className="activity-day">{group.label}</h4>
          {group.items.map((item) => (
            <ActivityItem key={item.id} item={item} compact={compact} />
          ))}
        </section>
      ))}
    </div>
  );
};
