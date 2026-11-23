import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { EnvValidationError } from './config/env.validation';
import { createValidationPipe } from './common/pipes/app-validation.pipe';
import { requestIdMiddleware } from './common/middleware/request-id.middleware';
import { requestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { buildCorsOptions, describeCors, parseCorsOrigins } from './config/cors.config';
import { Logger } from '@nestjs/common';

async function loadAppModule() {
  try {
    return (await import('./app.module.js')).AppModule;
  } catch (error) {
    if (
      error instanceof EnvValidationError ||
      (error as Error | undefined)?.name === 'EnvValidationError'
    ) {
      console.error(`\n${(error as Error).message}\n`);
      process.exit(1);
    }
    throw error;
  }
}

async function bootstrap() {
  const AppModule = await loadAppModule();
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.use(requestIdMiddleware, requestLoggerMiddleware);

  const isProduction = config.get<string>('NODE_ENV') === 'production';
  const corsOrigins = parseCorsOrigins(config.get<string>('CORS_ORIGINS'));
  app.enableCors(buildCorsOptions(corsOrigins, isProduction));
  new Logger('Bootstrap').log(describeCors(corsOrigins, isProduction));

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(createValidationPipe());
  app.enableShutdownHooks();

  await app.listen(config.getOrThrow<number>('PORT'));
}
void bootstrap();
