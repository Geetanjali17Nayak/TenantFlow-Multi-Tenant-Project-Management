import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  async validateTenantMembership(userId: string, tenantId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: tenantId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('User is not a member of the target tenant organization');
    }

    return membership;
  }
}
