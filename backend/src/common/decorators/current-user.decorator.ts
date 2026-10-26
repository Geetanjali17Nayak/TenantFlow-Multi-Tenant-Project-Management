import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface JwtPayloadUser {
  userId: string;
  email: string;
  tenantId?: string;
  role?: string;
}

export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayloadUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);
