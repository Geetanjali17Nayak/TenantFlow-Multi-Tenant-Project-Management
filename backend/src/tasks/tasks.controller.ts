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
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryTaskDto } from './dto/query-task.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../tenant/guards/tenant.guard';
import { PermissionsGuard } from '../permissions/guards/permissions.guard';
import { CurrentTenant, TenantContext } from '../tenant/decorators/current-tenant.decorator';
import { RequirePermissions } from '../permissions/decorators/require-permissions.decorator';
import { Permission } from '../permissions/permissions.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Tasks')
@ApiBearerAuth()
@ApiHeader({
  name: 'x-tenant-id',
  description: 'Target Organization/Tenant ID',
  required: false,
})
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller()
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post('projects/:projectId/tasks')
  @RequirePermissions(Permission.TASK_CREATE)
  @ApiOperation({ summary: 'Create a task inside a project' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 201, description: 'Task successfully created' })
  @ApiResponse({ status: 400, description: 'Assignee not in organization' })
  @ApiResponse({ status: 404, description: 'Project not found in organization' })
  async createTask(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser('userId') userId: string,
    @Param('projectId') projectId: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasksService.createTask(tenant.tenantId, userId, projectId, dto);
  }

  @Get('projects/:projectId/tasks')
  @RequirePermissions(Permission.TASK_READ)
  @ApiOperation({ summary: 'List tasks inside a specific project' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'List of project tasks retrieved' })
  async getProjectTasks(
    @CurrentTenant() tenant: TenantContext,
    @Param('projectId') projectId: string,
    @Query() query: QueryTaskDto,
  ) {
    return this.tasksService.getTasks(tenant.tenantId, { ...query, projectId });
  }

  @Get('tasks')
  @RequirePermissions(Permission.TASK_READ)
  @ApiOperation({ summary: 'List all tasks in active tenant with filtering' })
  @ApiResponse({ status: 200, description: 'Paginated tasks retrieved' })
  async getTasks(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: QueryTaskDto,
  ) {
    return this.tasksService.getTasks(tenant.tenantId, query);
  }

  @Get('tasks/:id')
  @RequirePermissions(Permission.TASK_READ)
  @ApiOperation({ summary: 'Get task details by ID' })
  @ApiParam({ name: 'id', description: 'Task ID' })
  @ApiResponse({ status: 200, description: 'Task details retrieved' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async getTaskById(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') taskId: string,
  ) {
    return this.tasksService.getTaskById(tenant.tenantId, taskId);
  }

  @Patch('tasks/:id')
  @RequirePermissions(Permission.TASK_UPDATE)
  @ApiOperation({ summary: 'Update task details' })
  @ApiParam({ name: 'id', description: 'Task ID' })
  @ApiResponse({ status: 200, description: 'Task updated successfully' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async updateTask(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser('userId') userId: string,
    @Param('id') taskId: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.updateTask(tenant.tenantId, userId, taskId, dto);
  }

  @Delete('tasks/:id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.TASK_DELETE)
  @ApiOperation({ summary: 'Delete a task' })
  @ApiParam({ name: 'id', description: 'Task ID' })
  @ApiResponse({ status: 200, description: 'Task deleted successfully' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async deleteTask(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser('userId') userId: string,
    @Param('id') taskId: string,
  ) {
    return this.tasksService.deleteTask(tenant.tenantId, userId, taskId);
  }
}
