import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { AppError } from './common/errors';
import type { ValidationError } from 'class-validator';

function flattenValidation(errors: ValidationError[]): string {
  return errors
    .flatMap((err) => {
      const current = err.constraints
        ? Object.values(err.constraints)
        : [];
      const nested = err.children?.length ? flattenValidation(err.children) : [];
      return [...current, ...nested];
    })
    .join('; ');
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true });
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      exceptionFactory: (errors) =>
        new AppError(
          400,
          'VALIDATION_ERROR',
          flattenValidation(errors) || 'Request validation failed.',
        ),
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
