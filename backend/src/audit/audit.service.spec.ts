import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AuditService } from './audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction, AuditEntity } from './audit.constants';

describe('AuditService', () => {
  let service: AuditService;
  let prisma: { auditLog: { create: jest.Mock; findMany: jest.Mock; count: jest.Mock } };

  // Rows for two tenants; the mock applies the where clause like the database would
  const rows = [
    { id: 'l1', tenantId: 'tenant-a', userId: 'user-a', action: 'TASK_CREATED', entity: 'Task', entityId: 'task-a', metadata: { title: 'A' }, createdAt: new Date('2026-10-02'), user: { id: 'user-a', name: 'A', email: 'a@x.com', avatarUrl: null } },
    { id: 'l2', tenantId: 'tenant-b', userId: 'user-b', action: 'TASK_CREATED', entity: 'Task', entityId: 'task-b', metadata: { title: 'B' }, createdAt: new Date('2026-10-03'), user: { id: 'user-b', name: 'B', email: 'b@x.com', avatarUrl: null } },
    { id: 'l3', tenantId: 'tenant-a', userId: null, action: 'PROJECT_DELETED', entity: 'Project', entityId: 'project-a', metadata: { name: 'P' }, createdAt: new Date('2026-10-04'), user: null },
  ];

  const matches = (row: any, where: any) =>
    Object.entries(where).every(([key, value]: [string, any]) => {
      if (key === 'createdAt') {
        return (!value.gte || row.createdAt >= value.gte) && (!value.lte || row.createdAt <= value.lte);
      }
      return row[key] === value;
    });

  beforeEach(async () => {
    prisma = {
      auditLog: {
        create: jest.fn(),
        findMany: jest.fn(({ where }) => Promise.resolve(rows.filter((r) => matches(r, where)))),
        count: jest.fn(({ where }) => Promise.resolve(rows.filter((r) => matches(r, where)).length)),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [AuditService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(AuditService);
  });

  describe('logAction', () => {
    it('writes through the transaction client when one is given', async () => {
      const tx = { auditLog: { create: jest.fn() } };

      await service.logAction('tenant-a', 'user-a', AuditAction.TASK_CREATED, AuditEntity.TASK, 'task-a', { title: 'A' }, tx as any);

      expect(tx.auditLog.create).toHaveBeenCalledWith({
        data: { tenantId: 'tenant-a', userId: 'user-a', action: 'TASK_CREATED', entity: 'Task', entityId: 'task-a', metadata: { title: 'A' } },
      });
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });
  });

  describe('getActivity', () => {
    it('always scopes to the given tenant', async () => {
      const result = await service.getActivity('tenant-a', {});

      expect(result.data.map((d) => d.id)).toEqual(['l1', 'l3']);
      expect(result.meta).toEqual({ total: 2, page: 1, limit: 20, totalPages: 1 });
      for (const call of [...prisma.auditLog.findMany.mock.calls, ...prisma.auditLog.count.mock.calls]) {
        expect(call[0].where.tenantId).toBe('tenant-a');
      }
    });

    it('never returns another tenant’s rows, even when filtering by their ids', async () => {
      const byEntity = await service.getActivity('tenant-a', { entity: AuditEntity.TASK, entityId: 'task-b' });
      const byActor = await service.getActivity('tenant-a', { actorId: 'user-b' });

      expect(byEntity.data).toEqual([]);
      expect(byEntity.meta.total).toBe(0);
      expect(byActor.data).toEqual([]);
      expect(byActor.meta.total).toBe(0);
    });

    it('rejects entityId without entity', async () => {
      await expect(service.getActivity('tenant-a', { entityId: 'task-a' })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects from after to', async () => {
      await expect(
        service.getActivity('tenant-a', { from: '2026-10-05T00:00:00Z', to: '2026-10-01T00:00:00Z' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('applies date range and stable ordering', async () => {
      const result = await service.getActivity('tenant-a', { from: '2026-10-03T00:00:00Z' });

      expect(result.data.map((d) => d.id)).toEqual(['l3']);
      expect(prisma.auditLog.findMany.mock.calls[0][0].orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
    });

    it('maps rows to feed items without tenantId or userId', async () => {
      const result = await service.getActivity('tenant-a', { entity: AuditEntity.PROJECT });

      expect(result.data[0]).toEqual({
        id: 'l3',
        action: 'PROJECT_DELETED',
        entity: 'Project',
        entityId: 'project-a',
        actor: null,
        metadata: { name: 'P' },
        createdAt: new Date('2026-10-04'),
      });
      expect(result.data[0]).not.toHaveProperty('tenantId');
      expect(result.data[0]).not.toHaveProperty('userId');
    });
  });
});
