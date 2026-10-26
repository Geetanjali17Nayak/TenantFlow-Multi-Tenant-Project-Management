import { Controller, Get, HttpStatus, HttpException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly prismaService: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Check application and database health' })
  @ApiResponse({
    status: 200,
    description: 'System and Neon cloud database are healthy',
    schema: {
      example: {
        status: 'ok',
        timestamp: '2026-09-20T22:45:00.000Z',
        uptime: 12.34,
        database: {
          status: 'up',
          latencyMs: 45,
        },
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: 'Database service unavailable',
  })
  async checkHealth() {
    const startTime = Date.now();
    let dbStatus = 'down';
    let dbLatency = 0;

    try {
      await this.prismaService.$queryRaw`SELECT 1`;
      dbStatus = 'up';
      dbLatency = Date.now() - startTime;
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          database: {
            status: 'down',
            error: error instanceof Error ? error.message : 'Database query failed',
          },
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        status: dbStatus,
        latencyMs: dbLatency,
      },
    };
  }
}
