import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Diagnostic de démarrage : variables critiques manquantes ?
  if (!process.env.DATABASE_URL) {
    logger.error(
      "DATABASE_URL est absente ! Reliez un service PostgreSQL et définissez " +
        "DATABASE_URL=${{Postgres.DATABASE_URL}}. L'API démarre mais la base " +
        'sera injoignable.',
    );
  }
  if (!process.env.JWT_SECRET) {
    logger.warn('JWT_SECRET absent — un secret par défaut non sécurisé est utilisé.');
  }

  const app = await NestFactory.create(AppModule, { cors: true });

  const apiPrefix = process.env.API_PREFIX ?? 'api';
  app.setGlobalPrefix(apiPrefix);

  // Validation globale des DTO
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Format de réponse & gestion d'erreurs homogènes
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // ── Documentation Swagger ──
  const swaggerConfig = new DocumentBuilder()
    .setTitle('CreditCEP AI — API')
    .setDescription(
      "API du systeme intelligent d'analyse et d'octroi de credit agricole " +
        'pour cooperatives (CEP / ProSMAT) via WhatsApp.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('auth', 'Authentification & JWT')
    .addTag('users', 'Gestion des utilisateurs')
    .addTag('cooperatives', 'Cooperatives (CEP)')
    .addTag('credit-requests', 'Demandes de credit')
    .addTag('scoring', 'Moteur de decision (IA)')
    .addTag('dashboard', 'Tableau de bord & exports')
    .addTag('whatsapp', 'Bot WhatsApp (Baileys)')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document);

  // Railway/Heroku fournissent le port via PORT ; on écoute sur 0.0.0.0.
  const port = parseInt(process.env.PORT ?? process.env.BACKEND_PORT ?? '3001', 10);
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 CreditCEP AI backend prêt sur http://localhost:${port}/${apiPrefix}`);
  logger.log(`📚 Swagger : http://localhost:${port}/${apiPrefix}/docs`);
}

bootstrap();
