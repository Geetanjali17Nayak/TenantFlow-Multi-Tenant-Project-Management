import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskPriority, TaskStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateTaskDto {
  @ApiProperty({ example: 'Implement auth tokens refresh flow', description: 'Title of the task' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title: string;

  @ApiPropertyOptional({ example: 'Ensure tokens rotate correctly on expiration', description: 'Task description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ enum: TaskStatus, default: TaskStatus.TODO, description: 'Current status of task' })
  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus = TaskStatus.TODO;

  @ApiPropertyOptional({ enum: TaskPriority, default: TaskPriority.MEDIUM, description: 'Task priority level' })
  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority = TaskPriority.MEDIUM;

  @ApiPropertyOptional({ example: 'a1b2c3d4-e5f6-7890-abcd-1234567890ab', description: 'Assignee User ID' })
  @IsUUID()
  @IsOptional()
  assigneeId?: string;
}
