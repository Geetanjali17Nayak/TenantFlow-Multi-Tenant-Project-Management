import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService, UserWithoutPassword } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: UserWithoutPassword;
  tokens: AuthTokens;
}

@Injectable()
export class AuthService {
  private readonly saltRounds = 10;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const passwordHash = await bcrypt.hash(registerDto.password, this.saltRounds);

    const user = await this.usersService.create({
      email: registerDto.email,
      passwordHash,
      name: registerDto.name,
    });

    const tokens = await this.generateTokens(user.id, user.email);

    return {
      user,
      tokens,
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const sanitizedUser = this.usersService.sanitizeUser(user);
    const tokens = await this.generateTokens(user.id, user.email);

    return {
      user: sanitizedUser,
      tokens,
    };
  }

  async refreshTokens(userId: string, email: string): Promise<AuthTokens> {
    return this.generateTokens(userId, email);
  }

  async generateTokens(userId: string, email: string, tenantId?: string, role?: string): Promise<AuthTokens> {
    const payload: Record<string, any> = { sub: userId, email };
    if (tenantId) payload.tenantId = tenantId;
    if (role) payload.role = role;

    const jwtSecret = this.configService.get<string>('JWT_SECRET') || 'super-secret-jwt-key-tenantflow';
    const jwtExpiresIn = this.configService.get<string>('JWT_EXPIRES_IN') || '15m';

    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET') || 'super-secret-refresh-jwt-key-tenantflow';
    const refreshExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: jwtSecret,
        expiresIn: jwtExpiresIn,
      }),
      this.jwtService.signAsync(payload, {
        secret: refreshSecret,
        expiresIn: refreshExpiresIn,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  async generateTenantTokens(userId: string, email: string, tenantId: string, role: string): Promise<AuthTokens> {
    return this.generateTokens(userId, email, tenantId, role);
  }
}
