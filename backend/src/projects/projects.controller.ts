import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiHeader, ApiParam } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { QueryProjectDto } from './dto/query-project.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../tenant/guards/tenant.guard';
import { PermissionsGuard } from '../permissions/guards/permissions.guard';
import { CurrentTenant, TenantContext } from '../tenant/decorators/current-tenant.decorator';
import { RequirePermissions } from '../permissions/decorators/require-permissions.decorator';
import { Permission } from '../permissions/permissions.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Projects')
@ApiBearerAuth()
@ApiHeader({
  name: 'x-tenant-id',
  description: 'Target Organization/Tenant ID',
  required: false,
})
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @RequirePermissions(Permission.PROJECT_CREATE)
  @ApiOperation({ summary: 'Create a new project in active tenant' })
  @ApiResponse({ status: 201, description: 'Project successfully created' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async createProject(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projectsService.createProject(tenant.tenantId, userId, dto);
  }

  @Get()
  @RequirePermissions(Permission.PROJECT_READ)
  @ApiOperation({ summary: 'List projects in active tenant with pagination and search' })
  @ApiResponse({ status: 200, description: 'Paginated list of projects retrieved' })
  async getProjects(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: QueryProjectDto,
  ) {
    return this.projectsService.getProjects(tenant.tenantId, query);
  }

  @Get(':id')
  @RequirePermissions(Permission.PROJECT_READ)
  @ApiOperation({ summary: 'Get project details by ID' })
  @ApiParam({ name: 'id', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Project details retrieved' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async getProjectById(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') projectId: string,
  ) {
    return this.projectsService.getProjectById(tenant.tenantId, projectId);
  }

  @Patch(':id')
  @RequirePermissions(Permission.PROJECT_UPDATE)
  @ApiOperation({ summary: 'Update project details' })
  @ApiParam({ name: 'id', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Project updated successfully' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async updateProject(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser('userId') userId: string,
    @Param('id') projectId: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.updateProject(tenant.tenantId, userId, projectId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.PROJECT_DELETE)
  @ApiOperation({ summary: 'Delete a project' })
  @ApiParam({ name: 'id', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Project deleted successfully' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async deleteProject(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser('userId') userId: string,
    @Param('id') projectId: string,
  ) {
    return this.projectsService.deleteProject(tenant.tenantId, userId, projectId);
  }
}
