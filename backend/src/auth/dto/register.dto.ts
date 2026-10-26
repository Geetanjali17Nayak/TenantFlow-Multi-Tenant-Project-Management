import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'user@tenantflow.com', description: 'User email address' })
  @IsEmail({}, { message: 'Please enter a valid email address' })
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'SecureP@ssw0rd!', description: 'Minimum 8 characters' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;

  @ApiProperty({ example: 'Geetanjali Nayak', description: 'User full name' })
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  name: string;
}
