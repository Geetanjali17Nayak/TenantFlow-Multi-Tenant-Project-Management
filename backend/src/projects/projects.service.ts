import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { QueryProjectDto } from './dto/query-project.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async createProject(tenantId: string, dto: CreateProjectDto) {
    return this.prisma.project.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
      },
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

  async updateProject(tenantId: string, projectId: string, dto: UpdateProjectDto) {
    // Verify existence within tenant
    await this.getProjectById(tenantId, projectId);

    return this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
    });
  }

  async deleteProject(tenantId: string, projectId: string) {
    // Verify existence within tenant
    await this.getProjectById(tenantId, projectId);

    await this.prisma.project.delete({
      where: { id: projectId },
    });

    return { message: 'Project successfully deleted' };
  }
}
