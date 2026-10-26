import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AuthService } from '../auth/auth.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuditAction, AuditEntity } from '../audit/audit.constants';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
    private readonly auditService: AuditService,
  ) {}

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  async createOrganization(userId: string, dto: CreateOrganizationDto) {
    const slug = dto.slug ? this.slugify(dto.slug) : this.slugify(dto.name);

    if (!slug) {
      throw new BadRequestException('Invalid organization name or slug');
    }

    const existingOrg = await this.prisma.organization.findUnique({
      where: { slug },
    });

    if (existingOrg) {
      throw new ConflictException(`Organization with slug "${slug}" already exists`);
    }

    // Use Prisma transaction to atomically create Organization and OWNER Membership
    return this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: dto.name,
          slug,
        },
      });

      const membership = await tx.membership.create({
        data: {
          userId,
          organizationId: organization.id,
          role: Role.OWNER,
        },
      });

      return {
        ...organization,
        role: membership.role,
      };
    });
  }

  async getUserOrganizations(userId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      include: {
        organization: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      role: m.role,
      membershipId: m.id,
      joinedAt: m.createdAt,
      createdAt: m.organization.createdAt,
      updatedAt: m.organization.updatedAt,
    }));
  }

  async getOrganizationById(userId: string, orgId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: orgId,
        },
      },
      include: {
        organization: true,
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this organization');
    }

    return {
      ...membership.organization,
      role: membership.role,
    };
  }

  async updateOrganization(userId: string, orgId: string, dto: UpdateOrganizationDto) {
    const membership = await this.verifyMembershipRole(userId, orgId, [Role.OWNER, Role.ADMIN]);

    let newSlug: string | undefined = undefined;
    if (dto.slug) {
      newSlug = this.slugify(dto.slug);
      const existing = await this.prisma.organization.findFirst({
        where: { slug: newSlug, NOT: { id: orgId } },
      });
      if (existing) {
        throw new ConflictException(`Organization slug "${newSlug}" is already taken`);
      }
    } else if (dto.name && !dto.slug) {
      // Keep existing slug unless explicitly provided
    }

    const updatedOrg = await this.prisma.organization.update({
      where: { id: orgId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(newSlug && { slug: newSlug }),
      },
    });

    return {
      ...updatedOrg,
      role: membership.role,
    };
  }

  async getMembers(userId: string, orgId: string) {
    await this.verifyMembership(userId, orgId);

    const members = await this.prisma.membership.findMany({
      where: { organizationId: orgId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return members.map((m) => ({
      membershipId: m.id,
      user: m.user,
      role: m.role,
      joinedAt: m.createdAt,
    }));
  }

  async addMember(userId: string, orgId: string, dto: AddMemberDto) {
    await this.verifyMembershipRole(userId, orgId, [Role.OWNER, Role.ADMIN]);

    const userToAdd = await this.usersService.findByEmail(dto.email);
    if (!userToAdd) {
      throw new NotFoundException(`User with email "${dto.email}" not found`);
    }

    const existingMembership = await this.prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: userToAdd.id,
          organizationId: orgId,
        },
      },
    });

    if (existingMembership) {
      throw new ConflictException(`User "${dto.email}" is already a member of this organization`);
    }

    const newMembership = await this.prisma.$transaction(async (tx) => {
      const membership = await tx.membership.create({
        data: {
          userId: userToAdd.id,
          organizationId: orgId,
          role: dto.role || Role.MEMBER,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      });

      // orgId is a verified tenant here: verifyMembershipRole passed above
      await this.auditService.logAction(
        orgId,
        userId,
        AuditAction.MEMBER_ADDED,
        AuditEntity.MEMBER,
        membership.userId,
        {
          memberName: membership.user.name,
          memberEmail: membership.user.email,
          membershipId: membership.id,
          role: membership.role,
        },
        tx,
      );

      return membership;
    });

    return {
      membershipId: newMembership.id,
      user: newMembership.user,
      role: newMembership.role,
      joinedAt: newMembership.createdAt,
    };
  }

  async updateMemberRole(userId: string, orgId: string, memberId: string, dto: UpdateMemberRoleDto) {
    const requesterMembership = await this.verifyMembershipRole(userId, orgId, [Role.OWNER, Role.ADMIN]);

    const targetMembership = await this.prisma.membership.findFirst({
      where: { id: memberId, organizationId: orgId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (!targetMembership) {
      throw new NotFoundException('Member record not found in this organization');
    }

    // Security check: Only OWNER can promote someone to OWNER or demote an OWNER
    if (targetMembership.role === Role.OWNER && requesterMembership.role !== Role.OWNER) {
      throw new ForbiddenException('Only organization OWNERs can modify an OWNER role');
    }

    if (dto.role === Role.OWNER && requesterMembership.role !== Role.OWNER) {
      throw new ForbiddenException('Only organization OWNERs can promote a member to OWNER');
    }

    // Same role: nothing changes, so nothing is written or logged
    if (dto.role === targetMembership.role) {
      return {
        membershipId: targetMembership.id,
        user: targetMembership.user,
        role: targetMembership.role,
        updatedAt: targetMembership.updatedAt,
      };
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const membership = await tx.membership.update({
        where: { id: memberId },
        data: { role: dto.role },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      });

      await this.auditService.logAction(
        orgId,
        userId,
        AuditAction.ROLE_CHANGED,
        AuditEntity.MEMBER,
        targetMembership.userId,
        {
          memberName: targetMembership.user.name,
          memberEmail: targetMembership.user.email,
          membershipId: targetMembership.id,
          changes: { role: { from: targetMembership.role, to: membership.role } },
        },
        tx,
      );

      return membership;
    });

    return {
      membershipId: updated.id,
      user: updated.user,
      role: updated.role,
      updatedAt: updated.updatedAt,
    };
  }

  async removeMember(userId: string, orgId: string, memberId: string) {
    const requesterMembership = await this.verifyMembership(userId, orgId);

    const targetMembership = await this.prisma.membership.findFirst({
      where: { id: memberId, organizationId: orgId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (!targetMembership) {
      throw new NotFoundException('Member record not found in this organization');
    }

    const isSelfRemoval = targetMembership.userId === userId;

    if (!isSelfRemoval) {
      if (requesterMembership.role !== Role.OWNER && requesterMembership.role !== Role.ADMIN) {
        throw new ForbiddenException('You do not have permission to remove this member');
      }
      if (targetMembership.role === Role.OWNER && requesterMembership.role !== Role.OWNER) {
        throw new ForbiddenException('Only organization OWNERs can remove another OWNER');
      }
    }

    // Prevent removing the last owner
    if (targetMembership.role === Role.OWNER) {
      const ownerCount = await this.prisma.membership.count({
        where: { organizationId: orgId, role: Role.OWNER },
      });
      if (ownerCount <= 1) {
        throw new BadRequestException('Cannot remove the sole OWNER of an organization');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.membership.delete({
        where: { id: memberId },
      });

      await this.auditService.logAction(
        orgId,
        userId,
        AuditAction.MEMBER_REMOVED,
        AuditEntity.MEMBER,
        targetMembership.userId,
        {
          memberName: targetMembership.user.name,
          memberEmail: targetMembership.user.email,
          membershipId: targetMembership.id,
          role: targetMembership.role,
          selfRemoval: isSelfRemoval,
        },
        tx,
      );
    });

    return { message: 'Member removed successfully' };
  }

  async switchTenant(userId: string, orgId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: orgId,
        },
      },
      include: {
        organization: true,
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this organization');
    }

    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const tokens = await this.authService.generateTenantTokens(userId, user.email, orgId, membership.role);

    return {
      activeOrganization: {
        id: membership.organization.id,
        name: membership.organization.name,
        slug: membership.organization.slug,
        role: membership.role,
      },
      tokens,
    };
  }

  private async verifyMembership(userId: string, orgId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: orgId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this organization');
    }

    return membership;
  }

  private async verifyMembershipRole(userId: string, orgId: string, allowedRoles: Role[]) {
    const membership = await this.verifyMembership(userId, orgId);

    if (!allowedRoles.includes(membership.role)) {
      throw new ForbiddenException(
        `Operation requires one of the following roles: ${allowedRoles.join(', ')}`,
      );
    }

    return membership;
  }
}
