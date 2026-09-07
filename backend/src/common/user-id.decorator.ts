import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { AppError } from './errors';

export const UserIdHeader = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<{ headers: Record<string, unknown> }>();
    const raw = request.headers['x-user-id'];
    const userId = Array.isArray(raw) ? raw[0] : raw;
    if (typeof userId !== 'string' || userId.trim().length === 0) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'X-User-Id header is required.',
      );
    }
    return userId;
  },
);
