import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { EnvValidationError } from './config/env.validation';
import { createValidationPipe } from './common/pipes/app-validation.pipe';
import { requestIdMiddleware } from './common/middleware/request-id.middleware';
import { requestLoggerMiddleware } from './common/middleware/request-logger.middleware';

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

  app.use(requestIdMiddleware, requestLoggerMiddleware);
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(createValidationPipe());
  app.enableShutdownHooks();

  await app.listen(app.get(ConfigService).getOrThrow<number>('PORT'));
}
void bootstrap();
