import { AsyncLocalStorage } from 'node:async_hooks';

export type ClientType = 'WEB' | 'MOBILE';

const clientTypeContext = new AsyncLocalStorage<ClientType>();

export function runWithClientType<T>(clientType: ClientType, callback: () => T): T {
  return clientTypeContext.run(clientType, callback);
}

export function getClientType(): ClientType {
  return clientTypeContext.getStore() || 'WEB';
}
