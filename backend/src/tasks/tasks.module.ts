import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { TenantModule } from '../tenant/tenant.module';
import { PermissionsModule } from '../permissions/permissions.module';

@Module({
  imports: [TenantModule, PermissionsModule],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
