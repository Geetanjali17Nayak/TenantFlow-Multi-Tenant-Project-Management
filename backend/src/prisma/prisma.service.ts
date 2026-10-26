import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    this.logger.log('Connecting to Neon PostgreSQL cloud database...');
    let retries = 5;
    while (retries > 0) {
      try {
        await this.$connect();
        this.logger.log('Successfully connected to Neon PostgreSQL database.');
        break;
      } catch (err: any) {
        retries--;
        if (retries === 0) {
          this.logger.error(`Failed to connect to PostgreSQL database after retries: ${err.message}`);
          throw err;
        }
        this.logger.warn(`Database connection attempt failed (${err.message}). Retrying in 3s... (${retries} retries left)`);
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  }

  async onModuleDestroy() {
    this.logger.log('Disconnecting from Neon PostgreSQL cloud database...');
    await this.$disconnect();
  }
}
