import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

interface ErrorResponseBody {
  statusCode: number;
  error: string;
  message: string | string[];
  correlationId: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { correlationId?: string }>();

    // Guards run before interceptors, so guard rejections may arrive here
    // with no correlation id yet — generate one so the envelope is uniform.
    const correlationId =
      request.correlationId ??
      (request.headers['x-correlation-id'] as string | undefined) ??
      randomUUID();
    request.correlationId = correlationId;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = 'Internal Server Error';
    let message: string | string[] = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      error = exception.name;
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const parsed = body as Record<string, unknown>;
        if (typeof parsed['message'] === 'string' || Array.isArray(parsed['message'])) {
          message = parsed['message'] as string | string[];
        }
        if (typeof parsed['error'] === 'string') {
          error = parsed['error'];
        }
      }
    } else {
      this.logger.error(
        `Unhandled error [${correlationId}]: ${(exception as Error)?.message ?? 'unknown'}`,
        (exception as Error)?.stack,
      );
    }

    const body: ErrorResponseBody = {
      statusCode: status,
      error,
      message,
      correlationId,
    };
    response.status(status).json(body);
  }
}
