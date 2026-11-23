import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const SWAGGER_PATH = 'api/docs';
export const SWAGGER_AUTH_NAME = 'access-token';

export function shouldEnableSwagger(nodeEnv: string | undefined): boolean {
  return nodeEnv !== 'production';
}

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Daily Cost API')
    .setDescription(
      'REST API for shared family expense and income ' +
        'tracking. Supports family wallets, categories, ' +
        'transactions, members, and monthly reports.',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT access token.',
      },
      SWAGGER_AUTH_NAME,
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    useGlobalPrefix: false,
    jsonDocumentUrl: '/api/docs-json',
    swaggerOptions: {
      persistAuthorization: false,
    },
  });
}
