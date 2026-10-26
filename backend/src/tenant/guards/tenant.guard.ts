import {
  CanActivate,
  ExecutionContext,
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { TenantService } from '../tenant.service';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly tenantService: TenantService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.userId) {
      throw new UnauthorizedException('Authentication required before tenant context validation');
    }

    // Determine tenantId from HTTP header x-tenant-id, route param tenantId/orgId, or JWT payload claim
    const headerTenantId = request.headers['x-tenant-id'] as string;
    const paramTenantId = request.params?.tenantId || request.params?.orgId;
    const tokenTenantId = user.tenantId;

    const tenantId = headerTenantId || paramTenantId || tokenTenantId;

    if (!tenantId) {
      throw new BadRequestException(
        'Active tenant context is missing. Please supply x-tenant-id header or switch tenant context.',
      );
    }

    // Verify user belongs to tenantId
    const membership = await this.tenantService.validateTenantMembership(user.userId, tenantId);

    // Attach verified tenant details to request object
    request.tenant = {
      tenantId: membership.organizationId,
      role: membership.role,
    };

    return true;
  }
}
