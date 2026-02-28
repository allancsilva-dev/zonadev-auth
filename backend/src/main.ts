import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Cookie parser — necessário para ler cookies HTTP-only
  app.use(cookieParser());

  // CORS — credenciais obrigatório para cookies cross-subdomain
  // NUNCA usar origin: '*' com credentials — browser rejeita
  // TODO v2.0: migrar para função dinâmica ao suportar domínios customizados por cliente
  app.enableCors({
    origin: (process.env.ALLOWED_ORIGINS ?? '').split(',').filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Validação global com class-validator
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,        // Remove campos não declarados no DTO
      forbidNonWhitelisted: false,
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
