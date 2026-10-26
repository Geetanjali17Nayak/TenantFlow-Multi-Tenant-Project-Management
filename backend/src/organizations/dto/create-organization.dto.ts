import { IsString, IsNotEmpty, IsOptional, Matches, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOrganizationDto {
  @ApiProperty({ example: 'Acme Corporation', description: 'The name of the organization' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  name: string;

  @ApiPropertyOptional({
    example: 'acme-corp',
    description: 'Unique URL slug for the organization (auto-generated from name if omitted)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug can only contain lowercase letters, numbers, and hyphens',
  })
  @Length(2, 50)
  slug?: string;
}
