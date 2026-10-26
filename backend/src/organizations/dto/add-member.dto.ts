import { IsEmail, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class AddMemberDto {
  @ApiProperty({ example: 'colleague@example.com', description: 'Email address of the user to add as member' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({ enum: Role, default: Role.MEMBER, description: 'Role assigned to the new member' })
  @IsOptional()
  @IsEnum(Role)
  role?: Role = Role.MEMBER;
}
