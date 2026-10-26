import { diffProject, diffTask } from './audit-diff';

const baseTask = {
  title: 'Fix login bug',
  description: 'Steps to reproduce…',
  status: 'TODO',
  priority: 'MEDIUM',
  assigneeId: null as string | null,
  assignee: null as { name: string } | null,
};

describe('diffTask', () => {
  it('returns an empty object when nothing changed', () => {
    expect(diffTask(baseTask, { ...baseTask })).toEqual({});
  });

  it('returns only the changed fields as { from, to }', () => {
    expect(diffTask(baseTask, { ...baseTask, status: 'DONE' })).toEqual({
      status: { from: 'TODO', to: 'DONE' },
    });
  });

  it('records assignee id and name when assigning', () => {
    const changes = diffTask(baseTask, { ...baseTask, assigneeId: 'user-1', assignee: { name: 'Priya' } });
    expect(changes).toEqual({
      assigneeId: { from: null, to: 'user-1' },
      assigneeName: { from: null, to: 'Priya' },
    });
  });

  it('marks description as changed without storing its text', () => {
    const changes = diffTask(baseTask, { ...baseTask, description: 'Secret new text' });
    expect(changes).toEqual({ description: { changed: true } });
    expect(JSON.stringify(changes)).not.toContain('Secret');
  });

  it('treats undefined and null descriptions as equal', () => {
    expect(diffTask({ ...baseTask, description: undefined }, { ...baseTask, description: null })).toEqual({});
  });
});

describe('diffProject', () => {
  it('records renames and description edits', () => {
    expect(
      diffProject({ name: 'Website', description: null }, { name: 'Marketing site', description: 'New' }),
    ).toEqual({
      name: { from: 'Website', to: 'Marketing site' },
      description: { changed: true },
    });
  });

  it('returns an empty object when nothing changed', () => {
    expect(diffProject({ name: 'Website', description: 'x' }, { name: 'Website', description: 'x' })).toEqual({});
  });
});
