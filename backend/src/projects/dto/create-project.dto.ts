import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateProjectDto {
  @ApiProperty({ example: 'Mobile App Redesign', description: 'Name of the project' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    example: 'Redesigning the iOS and Android applications for better UX',
    description: 'Detailed project description',
  })
  @IsString()
  @IsOptional()
  description?: string;
}
