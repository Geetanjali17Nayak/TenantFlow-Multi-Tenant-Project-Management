import { Global, Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { ActivityController } from './activity.controller';
import { AuditService } from './audit.service';
import { TenantModule } from '../tenant/tenant.module';
import { PermissionsModule } from '../permissions/permissions.module';

@Global()
@Module({
  imports: [TenantModule, PermissionsModule],
  controllers: [AuditController, ActivityController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
