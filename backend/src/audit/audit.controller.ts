import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { QueryAuditDto } from './dto/query-audit.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../tenant/guards/tenant.guard';
import { PermissionsGuard } from '../permissions/guards/permissions.guard';
import { CurrentTenant, TenantContext } from '../tenant/decorators/current-tenant.decorator';
import { RequirePermissions } from '../permissions/decorators/require-permissions.decorator';
import { Permission } from '../permissions/permissions.enum';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@ApiHeader({
  name: 'x-tenant-id',
  description: 'Target Organization/Tenant ID',
  required: false,
})
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermissions(Permission.AUDIT_READ)
  @ApiOperation({ summary: 'List tenant audit logs with pagination and filters' })
  @ApiResponse({ status: 200, description: 'Audit logs successfully retrieved' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getAuditLogs(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: QueryAuditDto,
  ) {
    return this.auditService.getAuditLogs(tenant.tenantId, query);
  }
}
