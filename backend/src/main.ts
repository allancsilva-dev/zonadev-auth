import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AppCacheService } from './modules/app/app-cache.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Confia no primeiro proxy reverso (Nginx) para propagação de IP real.
  // Necessário para req.ip e X-Forwarded-For funcionarem corretamente
  // no rate limit do ThrottlerGuard e nos audit logs.
  app.set('trust proxy', 1);

  // Cookie parser — necessário para ler cookies HTTP-only
  app.use(cookieParser());

  const appCacheService = app.get(AppCacheService);

  // CORS dinâmico — apps e origins são carregados do banco via cache in-memory
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin || appCacheService.isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS policy`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
  });

  // Validação global com class-validator
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,        // Remove campos não declarados no DTO
      forbidNonWhitelisted: true,
      transform: true,        // Auto-transform de tipos
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Filtro de exceções — resposta padronizada
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);

  console.log(`🚀 ZonaDev Auth rodando em http://localhost:${port}`);
  console.log(`   JWKS: http://localhost:${port}/.well-known/jwks.json`);
  console.log(`   Health: http://localhost:${port}/health`);
  console.log(`   Ambiente: ${process.env.NODE_ENV ?? 'development'}`);
}

bootstrap();
