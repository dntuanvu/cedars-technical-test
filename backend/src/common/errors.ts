import { HttpException } from '@nestjs/common';
import { DomainError } from '../domain/types';

export class AppError extends HttpException {
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super({ code, message }, status);
    this.code = code;
  }
}

export function mapDomainError(err: unknown): never {
  if (err instanceof DomainError) {
    const status =
      err.code === 'SESSION_ALREADY_ACTIVE'
        ? 409
        : err.code === 'NO_ACTIVE_SESSION'
          ? 404
          : err.code === 'COPILOT_INVALID_TOOL_CALL'
            ? 422
            : 400;
    throw new AppError(status, err.code, err.message);
  }
  throw err;
}
