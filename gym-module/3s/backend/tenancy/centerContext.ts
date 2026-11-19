import { AsyncLocalStorage } from 'node:async_hooks';

type CenterScope = { kind: 'center'; centerId: string } | { kind: 'system' };

const centerScope = new AsyncLocalStorage<CenterScope>();

export class MissingCenterScopeError extends Error {
  constructor(modelName: string) {
    super(`Center scope is required to access ${modelName}.`);
    this.name = 'MissingCenterScopeError';
  }
}

type ScopedResult<T> = T extends PromiseLike<unknown> ? Promise<Awaited<T>> : T;

function executeInScope<T>(work: () => T): ScopedResult<T> {
  const result = work();
  // Mongoose queries are lazy thenables. Assimilate them while AsyncLocalStorage
  // is still active; otherwise an outer `await` executes the query without scope.
  if (result !== null && (typeof result === 'object' || typeof result === 'function') && 'then' in result && typeof result.then === 'function') {
    return Promise.resolve(result) as ScopedResult<T>;
  }
  return result as ScopedResult<T>;
}

export function runWithCenter<T>(centerId: string, work: () => T): ScopedResult<T> {
  if (!centerId?.trim()) throw new Error('A center ID is required for tenant-scoped work.');
  return centerScope.run({ kind: 'center', centerId: centerId.trim() }, () => executeInScope(work));
}

export function runWithSystemCenterAccess<T>(work: () => T): ScopedResult<T> {
  return centerScope.run({ kind: 'system' }, () => executeInScope(work));
}

export function getCenterScope() {
  return centerScope.getStore();
}

export function requireCenterId(modelName: string): string {
  const scope = getCenterScope();
  if (!scope || scope.kind !== 'center') throw new MissingCenterScopeError(modelName);
  return scope.centerId;
}
