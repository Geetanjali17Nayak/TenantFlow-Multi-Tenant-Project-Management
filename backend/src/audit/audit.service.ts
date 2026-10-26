import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueryAuditDto } from './dto/query-audit.dto';
import { QueryActivityDto } from './dto/query-activity.dto';
import { AuditAction, AuditEntity } from './audit.constants';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async logAction(
    tenantId: string,
    userId: string | null,
    action: AuditAction,
    entity: AuditEntity,
    entityId: string,
    metadata?: Record<string, any>,
    tx?: Prisma.TransactionClient,
  ) {
    // Pass the caller's transaction client so the audit row commits or rolls back with the change
    return (tx ?? this.prisma).auditLog.create({
      data: {
        tenantId,
        userId,
        action,
        entity,
        entityId,
        metadata: metadata || undefined,
      },
    });
  }

  async getAuditLogs(tenantId: string, query: QueryAuditDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };

    if (query.action) {
      where.action = query.action;
    }

    if (query.entity) {
      where.entity = query.entity;
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getActivity(tenantId: string, query: QueryActivityDto) {
    if (query.entityId && !query.entity) {
      throw new BadRequestException('entity is required when entityId is set');
    }

    if (query.from && query.to && new Date(query.from) > new Date(query.to)) {
      throw new BadRequestException('from must be before to');
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    // tenantId always comes from the resolved tenant context; filters only narrow it
    const where: Prisma.AuditLogWhereInput = { tenantId };

    if (query.entity) {
      where.entity = query.entity;
    }

    if (query.entityId) {
      where.entityId = query.entityId;
    }

    if (query.actorId) {
      where.userId = query.actorId;
    }

    if (query.from || query.to) {
      where.createdAt = {
        ...(query.from && { gte: new Date(query.from) }),
        ...(query.to && { lte: new Date(query.to) }),
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: items.map((log) => ({
        id: log.id,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        actor: log.user ?? null,
        metadata: log.metadata,
        createdAt: log.createdAt,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
