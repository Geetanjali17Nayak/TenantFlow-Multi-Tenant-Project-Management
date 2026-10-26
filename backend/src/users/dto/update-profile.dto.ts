import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength, ValidateIf } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Geetanjali Nayak', maxLength: 100, description: 'Display name' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Name cannot be empty' })
  @MaxLength(100, { message: 'Name must be at most 100 characters' })
  name?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/avatar.png',
    nullable: true,
    maxLength: 2048,
    description: 'Absolute https:// image URL, or null to remove the avatar',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUrl({ protocols: ['https'], require_protocol: true }, { message: 'Avatar must be an https:// URL' })
  @MaxLength(2048, { message: 'Avatar URL must be at most 2048 characters' })
  avatarUrl?: string | null;
}
