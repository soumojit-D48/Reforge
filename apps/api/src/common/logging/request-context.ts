import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestLogContext {
  correlationId: string;
}

const storage = new AsyncLocalStorage<RequestLogContext>();

export function runWithRequestContext<T>(
  context: RequestLogContext,
  callback: () => T,
): T {
  return storage.run(context, callback);
}

export function getRequestLogContext(): RequestLogContext | undefined {
  return storage.getStore();
}
