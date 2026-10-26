import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from '@prisma/client';

export interface TenantContextData {
  tenantId: string;
  role: Role;
}

export type TenantContext = TenantContextData;

export const CurrentTenant = createParamDecorator(
  (data: keyof TenantContextData | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const tenantContext: TenantContextData | undefined = request.tenant;

    if (!data) {
      if (tenantContext) {
        return tenantContext;
      }
      const fallbackTenantId = request.headers['x-tenant-id'] || request.user?.tenantId;
      return { tenantId: fallbackTenantId, role: undefined };
    }

    return tenantContext ? tenantContext[data] : undefined;
  },
);

