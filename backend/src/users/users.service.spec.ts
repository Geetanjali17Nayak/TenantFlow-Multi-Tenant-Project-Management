import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService (profile)', () => {
  let service: UsersService;
  let prisma: { user: { findUnique: jest.Mock; update: jest.Mock } };
  let userA: any;

  beforeEach(async () => {
    userA = {
      id: 'user-a',
      email: 'a@tenantflow.com',
      name: 'User A',
      avatarUrl: null,
      passwordHash: await bcrypt.hash('OldPassw0rd', 4),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(UsersService);
  });

  describe('updateProfile', () => {
    it('updates only the calling user and never returns passwordHash', async () => {
      prisma.user.findUnique.mockResolvedValue(userA);
      prisma.user.update.mockResolvedValue({ ...userA, name: 'New Name' });

      const result = await service.updateProfile('user-a', { name: 'New Name' });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-a' },
        data: { name: 'New Name' },
      });
      expect(result.name).toBe('New Name');
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('rejects an empty body', async () => {
      await expect(service.updateProfile('user-a', {})).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('clears the avatar when avatarUrl is null', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...userA, avatarUrl: 'https://cdn.example.com/a.png' });
      prisma.user.update.mockResolvedValue(userA);

      await service.updateProfile('user-a', { avatarUrl: null });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-a' },
        data: { avatarUrl: null },
      });
    });

    it('throws NotFound when the user no longer exists', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.updateProfile('ghost', { name: 'x' })).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    it('stores a bcrypt hash of the new password', async () => {
      prisma.user.findUnique.mockResolvedValue(userA);
      prisma.user.update.mockResolvedValue(userA);

      const result = await service.changePassword('user-a', {
        currentPassword: 'OldPassw0rd',
        newPassword: 'NewPassw0rd',
      });

      expect(result).toEqual({ message: 'Password updated successfully' });
      const { where, data } = prisma.user.update.mock.calls[0][0];
      expect(where).toEqual({ id: 'user-a' });
      expect(data.passwordHash).not.toBe('NewPassw0rd');
      await expect(bcrypt.compare('NewPassw0rd', data.passwordHash)).resolves.toBe(true);
      await expect(bcrypt.compare('OldPassw0rd', data.passwordHash)).resolves.toBe(false);
    });

    it('rejects a wrong current password with 400 and does not update', async () => {
      prisma.user.findUnique.mockResolvedValue(userA);

      await expect(
        service.changePassword('user-a', { currentPassword: 'WrongPass1', newPassword: 'NewPassw0rd' }),
      ).rejects.toThrow(new BadRequestException('Current password is incorrect'));
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rejects reusing the current password', async () => {
      prisma.user.findUnique.mockResolvedValue(userA);

      await expect(
        service.changePassword('user-a', { currentPassword: 'OldPassw0rd', newPassword: 'OldPassw0rd' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('throws NotFound when the user no longer exists', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.changePassword('ghost', { currentPassword: 'OldPassw0rd', newPassword: 'NewPassw0rd' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
