import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { randomUUID } from 'node:crypto';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { Logger } from '@nestjs/common';
import { runWithRequestContext } from '../logging/request-context.js';

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CorrelationIdInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { correlationId?: string }>();
    const incoming = request.headers['x-correlation-id'];
    const correlationId =
      (Array.isArray(incoming) ? incoming[0] : incoming) ?? randomUUID();
    request.correlationId = correlationId;
    const startedAt = Date.now();
    return new Observable((subscriber) => {
      const subscription = runWithRequestContext(
        { correlationId },
        () =>
          next
            .handle()
            .pipe(
              finalize(() => {
                const response = context.switchToHttp().getResponse<{ statusCode: number }>();
                this.logger.log(
                  `${request.method} ${request.originalUrl} ${response.statusCode} ${Date.now() - startedAt}ms`,
                );
              }),
            )
            .subscribe(subscriber),
      );
      return () => subscription.unsubscribe();
    });
  }
}
