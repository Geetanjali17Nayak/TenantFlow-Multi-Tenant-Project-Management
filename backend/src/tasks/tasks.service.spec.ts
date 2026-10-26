import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

describe('TasksService (activity logging)', () => {
  let service: TasksService;
  let prisma: any;
  let tx: any;
  let audit: { logAction: jest.Mock };

  const existingTask = {
    id: 'task-1',
    tenantId: 'tenant-a',
    projectId: 'project-1',
    title: 'Fix login bug',
    description: null,
    status: 'TODO',
    priority: 'MEDIUM',
    assigneeId: null,
    project: { id: 'project-1', name: 'Website' },
    assignee: null,
  };

  beforeEach(async () => {
    tx = {
      task: { create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    };
    prisma = {
      project: { findFirst: jest.fn() },
      task: { findFirst: jest.fn() },
      membership: { findUnique: jest.fn() },
      $transaction: jest.fn((cb: (client: any) => unknown) => cb(tx)),
    };
    audit = { logAction: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = moduleRef.get(TasksService);
  });

  it('createTask logs TASK_CREATED inside the transaction', async () => {
    prisma.project.findFirst.mockResolvedValue({ id: 'project-1', tenantId: 'tenant-a' });
    tx.task.create.mockResolvedValue(existingTask);

    await service.createTask('tenant-a', 'user-1', 'project-1', { title: 'Fix login bug' } as any);

    expect(audit.logAction).toHaveBeenCalledWith(
      'tenant-a',
      'user-1',
      'TASK_CREATED',
      'Task',
      'task-1',
      expect.objectContaining({ title: 'Fix login bug', projectId: 'project-1', projectName: 'Website' }),
      tx,
    );
  });

  it('updateTask logs only the changed fields', async () => {
    prisma.task.findFirst.mockResolvedValue(existingTask);
    tx.task.update.mockResolvedValue({ ...existingTask, status: 'DONE' });

    await service.updateTask('tenant-a', 'user-1', 'task-1', { status: 'DONE' } as any);

    expect(audit.logAction).toHaveBeenCalledTimes(1);
    expect(audit.logAction.mock.calls[0][2]).toBe('TASK_UPDATED');
    expect(audit.logAction.mock.calls[0][5]).toEqual({
      title: 'Fix login bug',
      projectId: 'project-1',
      projectName: 'Website',
      changes: { status: { from: 'TODO', to: 'DONE' } },
    });
  });

  it('updateTask with no effective change writes no audit row', async () => {
    prisma.task.findFirst.mockResolvedValue(existingTask);
    tx.task.update.mockResolvedValue({ ...existingTask });

    await service.updateTask('tenant-a', 'user-1', 'task-1', { status: 'TODO' } as any);

    expect(audit.logAction).not.toHaveBeenCalled();
  });

  it('deleteTask logs TASK_DELETED with a name snapshot', async () => {
    prisma.task.findFirst.mockResolvedValue(existingTask);

    await service.deleteTask('tenant-a', 'user-1', 'task-1');

    expect(tx.task.delete).toHaveBeenCalledWith({ where: { id: 'task-1' } });
    expect(audit.logAction).toHaveBeenCalledWith(
      'tenant-a',
      'user-1',
      'TASK_DELETED',
      'Task',
      'task-1',
      { title: 'Fix login bug', projectId: 'project-1', projectName: 'Website' },
      tx,
    );
  });

  it('propagates an audit failure so the transaction rolls back', async () => {
    prisma.task.findFirst.mockResolvedValue(existingTask);
    tx.task.update.mockResolvedValue({ ...existingTask, status: 'DONE' });
    audit.logAction.mockRejectedValue(new Error('db down'));

    await expect(service.updateTask('tenant-a', 'user-1', 'task-1', { status: 'DONE' } as any)).rejects.toThrow(
      'db down',
    );
  });

  it('a task from another tenant is not found and nothing is logged', async () => {
    prisma.task.findFirst.mockResolvedValue(null);

    await expect(service.deleteTask('tenant-a', 'user-1', 'task-of-tenant-b')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.task.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'task-of-tenant-b', tenantId: 'tenant-a' } }),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(audit.logAction).not.toHaveBeenCalled();
  });
});
