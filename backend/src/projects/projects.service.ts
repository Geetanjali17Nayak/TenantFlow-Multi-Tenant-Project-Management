import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { QueryProjectDto } from './dto/query-project.dto';
import { AuditService } from '../audit/audit.service';
import { AuditAction, AuditEntity } from '../audit/audit.constants';
import { diffProject } from '../audit/audit-diff';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async createProject(tenantId: string, userId: string, dto: CreateProjectDto) {
    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          tenantId,
          name: dto.name,
          description: dto.description,
        },
      });

      await this.auditService.logAction(
        tenantId,
        userId,
        AuditAction.PROJECT_CREATED,
        AuditEntity.PROJECT,
        project.id,
        { name: project.name },
        tx,
      );

      return project;
    });
  }

  async getProjects(tenantId: string, query: QueryProjectDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { tasks: true },
          },
        },
      }),
      this.prisma.project.count({ where }),
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

  async getProjectById(tenantId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        tenantId,
      },
      include: {
        _count: {
          select: { tasks: true },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID "${projectId}" not found in current organization`);
    }

    return project;
  }

  async updateProject(tenantId: string, userId: string, projectId: string, dto: UpdateProjectDto) {
    // Verify existence within tenant (also the "before" snapshot for the audit diff)
    const before = await this.getProjectById(tenantId, projectId);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.project.update({
        where: { id: projectId },
        data: {
          ...(dto.name && { name: dto.name }),
          ...(dto.description !== undefined && { description: dto.description }),
        },
      });

      // No-op updates leave no audit trail
      const changes = diffProject(before, updated);
      if (Object.keys(changes).length > 0) {
        await this.auditService.logAction(
          tenantId,
          userId,
          AuditAction.PROJECT_UPDATED,
          AuditEntity.PROJECT,
          projectId,
          { name: updated.name, changes },
          tx,
        );
      }

      return updated;
    });
  }

  async deleteProject(tenantId: string, userId: string, projectId: string) {
    // Verify existence within tenant
    const project = await this.getProjectById(tenantId, projectId);

    // Tasks cascade at the DB level; one PROJECT_DELETED row records how many went with it
    await this.prisma.$transaction(async (tx) => {
      await tx.project.delete({
        where: { id: projectId },
      });

      await this.auditService.logAction(
        tenantId,
        userId,
        AuditAction.PROJECT_DELETED,
        AuditEntity.PROJECT,
        projectId,
        { name: project.name, taskCount: project._count.tasks },
        tx,
      );
    });

    return { message: 'Project successfully deleted' };
  }
}
