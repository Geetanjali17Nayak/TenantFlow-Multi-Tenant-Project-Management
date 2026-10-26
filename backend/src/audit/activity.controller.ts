import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { QueryActivityDto } from './dto/query-activity.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../tenant/guards/tenant.guard';
import { PermissionsGuard } from '../permissions/guards/permissions.guard';
import { CurrentTenant, TenantContext } from '../tenant/decorators/current-tenant.decorator';
import { RequirePermissions } from '../permissions/decorators/require-permissions.decorator';
import { Permission } from '../permissions/permissions.enum';

@ApiTags('Activity')
@ApiBearerAuth()
@ApiHeader({
  name: 'x-tenant-id',
  description: 'Target Organization/Tenant ID',
  required: false,
})
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('activity')
export class ActivityController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermissions(Permission.ACTIVITY_READ)
  @ApiOperation({ summary: 'Tenant activity feed (tasks, projects, members)' })
  @ApiResponse({ status: 200, description: 'Activity successfully retrieved' })
  @ApiResponse({ status: 400, description: 'Invalid filters' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not a member or insufficient permissions' })
  async getActivity(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: QueryActivityDto,
  ) {
    return this.auditService.getActivity(tenant.tenantId, query);
  }
}
