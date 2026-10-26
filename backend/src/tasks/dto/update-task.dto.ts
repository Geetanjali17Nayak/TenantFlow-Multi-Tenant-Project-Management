import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { TaskPriority, TaskStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateTaskDto } from './create-task.dto';

// status/priority are redeclared without CreateTaskDto's defaults: PartialType copies
// property initializers, so a PATCH that omitted them would reset them to TODO/MEDIUM
export class UpdateTaskDto extends PartialType(OmitType(CreateTaskDto, ['status', 'priority'] as const)) {
  @ApiPropertyOptional({ enum: TaskStatus, description: 'Current status of task' })
  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @ApiPropertyOptional({ enum: TaskPriority, description: 'Task priority level' })
  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;
}
