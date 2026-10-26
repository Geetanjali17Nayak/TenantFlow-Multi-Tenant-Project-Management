import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/require-roles.decorator';
import { Role } from '@prisma/client';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const tenant = request.tenant;

    if (!tenant || !tenant.role) {
      throw new UnauthorizedException(
        'Tenant context and active role required for role verification',
      );
    }

    const hasRole = requiredRoles.includes(tenant.role);

    if (!hasRole) {
      throw new ForbiddenException(
        `Insufficient role privileges. Required: [${requiredRoles.join(', ')}]`,
      );
    }

    return true;
  }
}
