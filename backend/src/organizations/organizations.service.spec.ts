import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { OrganizationsService } from './organizations.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AuthService } from '../auth/auth.service';
import { AuditService } from '../audit/audit.service';

describe('OrganizationsService (member activity logging)', () => {
  let service: OrganizationsService;
  let prisma: any;
  let tx: any;
  let audit: { logAction: jest.Mock };
  let usersService: { findByEmail: jest.Mock };

  const membership = (userId: string, role: Role, id = `m-${userId}`) => ({
    id,
    userId,
    organizationId: 'org-a',
    role,
    updatedAt: new Date(),
    user: { id: userId, name: `Name ${userId}`, email: `${userId}@tenantflow.com` },
  });

  beforeEach(async () => {
    tx = { membership: { create: jest.fn(), update: jest.fn(), delete: jest.fn() } };
    prisma = {
      membership: { findUnique: jest.fn(), findFirst: jest.fn(), count: jest.fn() },
      $transaction: jest.fn((cb: (client: any) => unknown) => cb(tx)),
    };
    audit = { logAction: jest.fn().mockResolvedValue(undefined) };
    usersService = { findByEmail: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        OrganizationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: UsersService, useValue: usersService },
        { provide: AuthService, useValue: {} },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = moduleRef.get(OrganizationsService);
  });

  it('addMember logs MEMBER_ADDED in the org, keyed by the added user', async () => {
    prisma.membership.findUnique
      .mockResolvedValueOnce(membership('admin', Role.ADMIN)) // requester
      .mockResolvedValueOnce(null); // not yet a member
    usersService.findByEmail.mockResolvedValue({ id: 'new-user', email: 'new-user@tenantflow.com' });
    tx.membership.create.mockResolvedValue({ ...membership('new-user', Role.MEMBER), createdAt: new Date() });

    await service.addMember('admin', 'org-a', { email: 'new-user@tenantflow.com' } as any);

    expect(audit.logAction).toHaveBeenCalledWith(
      'org-a',
      'admin',
      'MEMBER_ADDED',
      'Member',
      'new-user',
      expect.objectContaining({ memberEmail: 'new-user@tenantflow.com', membershipId: 'm-new-user', role: 'MEMBER' }),
      tx,
    );
  });

  it('updateMemberRole logs ROLE_CHANGED with from/to', async () => {
    prisma.membership.findUnique.mockResolvedValue(membership('owner', Role.OWNER));
    prisma.membership.findFirst.mockResolvedValue(membership('sam', Role.MEMBER));
    tx.membership.update.mockResolvedValue(membership('sam', Role.MANAGER));

    await service.updateMemberRole('owner', 'org-a', 'm-sam', { role: Role.MANAGER });

    expect(audit.logAction).toHaveBeenCalledWith(
      'org-a',
      'owner',
      'ROLE_CHANGED',
      'Member',
      'sam',
      expect.objectContaining({ changes: { role: { from: 'MEMBER', to: 'MANAGER' } } }),
      tx,
    );
  });

  it('updateMemberRole to the same role writes nothing', async () => {
    prisma.membership.findUnique.mockResolvedValue(membership('owner', Role.OWNER));
    prisma.membership.findFirst.mockResolvedValue(membership('sam', Role.MEMBER));

    const result = await service.updateMemberRole('owner', 'org-a', 'm-sam', { role: Role.MEMBER });

    expect(result.role).toBe(Role.MEMBER);
    expect(tx.membership.update).not.toHaveBeenCalled();
    expect(audit.logAction).not.toHaveBeenCalled();
  });

  it('a member leaving logs MEMBER_REMOVED with selfRemoval', async () => {
    prisma.membership.findUnique.mockResolvedValue(membership('sam', Role.MEMBER));
    prisma.membership.findFirst.mockResolvedValue(membership('sam', Role.MEMBER));

    await service.removeMember('sam', 'org-a', 'm-sam');

    expect(audit.logAction).toHaveBeenCalledWith(
      'org-a',
      'sam',
      'MEMBER_REMOVED',
      'Member',
      'sam',
      expect.objectContaining({ selfRemoval: true, role: 'MEMBER' }),
      tx,
    );
  });

  it('a forbidden removal logs nothing', async () => {
    prisma.membership.findUnique.mockResolvedValue(membership('viewer', Role.VIEWER));
    prisma.membership.findFirst.mockResolvedValue(membership('sam', Role.MEMBER));

    await expect(service.removeMember('viewer', 'org-a', 'm-sam')).rejects.toBeInstanceOf(ForbiddenException);
    expect(audit.logAction).not.toHaveBeenCalled();
  });

  it('removing the sole OWNER logs nothing', async () => {
    prisma.membership.findUnique.mockResolvedValue(membership('owner', Role.OWNER));
    prisma.membership.findFirst.mockResolvedValue(membership('owner', Role.OWNER));
    prisma.membership.count.mockResolvedValue(1);

    await expect(service.removeMember('owner', 'org-a', 'm-owner')).rejects.toBeInstanceOf(BadRequestException);
    expect(audit.logAction).not.toHaveBeenCalled();
  });
});
