import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { TenantModule } from '../tenant/tenant.module';
import { PermissionsModule } from '../permissions/permissions.module';

@Module({
  imports: [TenantModule, PermissionsModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
