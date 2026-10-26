import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryTaskDto } from './dto/query-task.dto';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async createTask(tenantId: string, projectId: string, dto: CreateTaskDto) {
    // 1. Validate that target project exists in active tenant
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenantId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID "${projectId}" not found in current organization`);
    }

    // 2. If assigneeId is supplied, validate user belongs to tenant
    if (dto.assigneeId) {
      const membership = await this.prisma.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: dto.assigneeId,
            organizationId: tenantId,
          },
        },
      });

      if (!membership) {
        throw new BadRequestException('Cannot assign task to a user who is not a member of this tenant');
      }
    }

    return this.prisma.task.create({
      data: {
        tenantId,
        projectId,
        title: dto.title,
        description: dto.description,
        status: dto.status,
        priority: dto.priority,
        assigneeId: dto.assigneeId,
      },
      include: {
        project: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async getTasks(tenantId: string, query: QueryTaskDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };

    if (query.projectId) {
      where.projectId = query.projectId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.priority) {
      where.priority = query.priority;
    }

    if (query.assigneeId) {
      where.assigneeId = query.assigneeId;
    }

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          project: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.task.count({ where }),
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

  async getTaskById(tenantId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        tenantId,
      },
      include: {
        project: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, email: true } },
      },
    });

    if (!task) {
      throw new NotFoundException(`Task with ID "${taskId}" not found in current organization`);
    }

    return task;
  }

  async updateTask(tenantId: string, taskId: string, dto: UpdateTaskDto) {
    // 1. Verify existence in tenant
    await this.getTaskById(tenantId, taskId);

    // 2. Validate assignee if being changed
    if (dto.assigneeId) {
      const membership = await this.prisma.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: dto.assigneeId,
            organizationId: tenantId,
          },
        },
      });

      if (!membership) {
        throw new BadRequestException('Cannot assign task to a user who is not a member of this tenant');
      }
    }

    return this.prisma.task.update({
      where: { id: taskId },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.status && { status: dto.status }),
        ...(dto.priority && { priority: dto.priority }),
        ...(dto.assigneeId !== undefined && { assigneeId: dto.assigneeId }),
      },
      include: {
        project: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async deleteTask(tenantId: string, taskId: string) {
    // Verify existence in tenant
    await this.getTaskById(tenantId, taskId);

    await this.prisma.task.delete({
      where: { id: taskId },
    });

    return { message: 'Task successfully deleted' };
  }
}
