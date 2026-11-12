import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

import { conOpcionesDeLaApi } from './opciones-conexion';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const url = process.env.DATABASE_URL;
    // Tiempo máximo por consulta y sin JIT, solo para la API (ver `conOpcionesDeLaApi`).
    super(url ? { datasources: { db: { url: conOpcionesDeLaApi(url) } } } : {});
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
