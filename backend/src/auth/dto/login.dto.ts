import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'user@tenantflow.com', description: 'Registered user email' })
  @IsEmail({}, { message: 'Please enter a valid email address' })
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'SecureP@ssw0rd!', description: 'User account password' })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password: string;
}
