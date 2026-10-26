import { Test } from '@nestjs/testing';
import { ProjectsService } from './projects.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

describe('ProjectsService (activity logging)', () => {
  let service: ProjectsService;
  let prisma: any;
  let tx: any;
  let audit: { logAction: jest.Mock };

  const existingProject = {
    id: 'project-1',
    tenantId: 'tenant-a',
    name: 'Website',
    description: null,
    _count: { tasks: 3 },
  };

  beforeEach(async () => {
    tx = { project: { create: jest.fn(), update: jest.fn(), delete: jest.fn() } };
    prisma = {
      project: { findFirst: jest.fn() },
      $transaction: jest.fn((cb: (client: any) => unknown) => cb(tx)),
    };
    audit = { logAction: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = moduleRef.get(ProjectsService);
  });

  it('createProject logs PROJECT_CREATED', async () => {
    tx.project.create.mockResolvedValue(existingProject);

    await service.createProject('tenant-a', 'user-1', { name: 'Website' } as any);

    expect(audit.logAction).toHaveBeenCalledWith(
      'tenant-a',
      'user-1',
      'PROJECT_CREATED',
      'Project',
      'project-1',
      { name: 'Website' },
      tx,
    );
  });

  it('updateProject logs a rename with from/to', async () => {
    prisma.project.findFirst.mockResolvedValue(existingProject);
    tx.project.update.mockResolvedValue({ ...existingProject, name: 'Marketing site' });

    await service.updateProject('tenant-a', 'user-1', 'project-1', { name: 'Marketing site' } as any);

    expect(audit.logAction.mock.calls[0][2]).toBe('PROJECT_UPDATED');
    expect(audit.logAction.mock.calls[0][5]).toEqual({
      name: 'Marketing site',
      changes: { name: { from: 'Website', to: 'Marketing site' } },
    });
  });

  it('updateProject with no effective change writes no audit row', async () => {
    prisma.project.findFirst.mockResolvedValue(existingProject);
    tx.project.update.mockResolvedValue({ ...existingProject });

    await service.updateProject('tenant-a', 'user-1', 'project-1', { name: 'Website' } as any);

    expect(audit.logAction).not.toHaveBeenCalled();
  });

  it('deleteProject logs one PROJECT_DELETED row with the task count', async () => {
    prisma.project.findFirst.mockResolvedValue(existingProject);

    await service.deleteProject('tenant-a', 'user-1', 'project-1');

    expect(audit.logAction).toHaveBeenCalledTimes(1);
    expect(audit.logAction).toHaveBeenCalledWith(
      'tenant-a',
      'user-1',
      'PROJECT_DELETED',
      'Project',
      'project-1',
      { name: 'Website', taskCount: 3 },
      tx,
    );
  });
});
