import mongoose, { type ClientSession, type Schema } from 'mongoose';
import Center from '../models/Center.js';
import { getCenterScope, MissingCenterScopeError, requireCenterId } from './centerContext.js';

const QUERY_OPERATIONS = [
  'countDocuments', 'deleteMany', 'deleteOne', 'distinct', 'find', 'findOne',
  'findOneAndDelete', 'findOneAndReplace', 'findOneAndUpdate', 'replaceOne',
  'updateMany', 'updateOne',
] as const;
type ModelMiddlewareNext = (error?: Error) => void;
type ModelMiddlewareHook = (this: unknown, next: ModelMiddlewareNext, value: unknown) => void;

function addModelMiddleware(schema: Schema, operation: 'insertMany' | 'bulkWrite', hook: ModelMiddlewareHook) {
  const register = schema.pre as unknown as (name: string, callback: ModelMiddlewareHook) => unknown;
  register.call(schema, operation, hook);
}

function containsCenterWrite(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(containsCenterWrite);
  return Object.entries(value as Record<string, unknown>).some(([key, child]) =>
    key === 'centerId' || key.startsWith('centerId.') || containsCenterWrite(child));
}

function scopeFilter(filter: Record<string, unknown>, centerId: string) {
  return { $and: [filter, { centerId }] };
}

async function assertCenterExists(session?: ClientSession | null) {
  const scope = getCenterScope();
  if (scope?.kind === 'center' && !await Center.exists({ _id: scope.centerId, status: 'ACTIVE' }).session(session ?? null)) {
    throw new Error('The center no longer exists. New tenant data cannot be created.');
  }
}

function preventRecreationAfterDeletion(schema: Schema) {
  schema.pre('save', async function () { await assertCenterExists(this.$session()); });
  addModelMiddleware(schema, 'insertMany', function (next) {
    void assertCenterExists().then(() => next(), error => next(error instanceof Error ? error : new Error('Unable to validate center.')));
  });
  for (const operation of ['findOneAndUpdate', 'updateOne', 'updateMany', 'replaceOne', 'findOneAndReplace', 'deleteOne', 'deleteMany', 'findOneAndDelete'] as const) {
    schema.pre(operation, async function () { await assertCenterExists(this.getOptions().session); });
  }
}

function addCenterToUpsert(update: unknown, centerId: string) {
  if (Array.isArray(update)) throw new Error('Aggregation pipeline updates are not allowed on tenant collections.');
  const value = update && typeof update === 'object' ? { ...update as Record<string, unknown> } : {};
  if (containsCenterWrite(value)) throw new Error('Tenant updates cannot change centerId.');
  const setOnInsert = value.$setOnInsert && typeof value.$setOnInsert === 'object'
    ? { ...value.$setOnInsert as Record<string, unknown> }
    : {};
  value.$setOnInsert = { ...setOnInsert, centerId };
  return value;
}

export function centerTenantPlugin(schema: Schema) {
  preventRecreationAfterDeletion(schema);
  schema.add({ centerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Center', required: false, index: true } });

  schema.pre('save', function () {
    const scope = getCenterScope();
    if (!scope) throw new MissingCenterScopeError(this.constructor.name);
    if (scope.kind === 'system') return;
    const current = this.get('centerId');
    if (current && String(current) !== scope.centerId) throw new Error('A tenant document cannot be moved between centers.');
    this.set('centerId', scope.centerId);
  });

  addModelMiddleware(schema, 'insertMany', function (next, value) {
    try {
      const scope = getCenterScope();
      if (!scope) throw new MissingCenterScopeError(schema.options.collection || 'tenant collection');
      if (scope.kind === 'system') { next(); return; }
      const documents = value as Array<Record<string, unknown>>;
      for (const document of documents) {
        const current = document.centerId;
        if (current && String(current) !== scope.centerId) throw new Error('A tenant document cannot be moved between centers.');
        document.centerId = scope.centerId;
      }
      next();
    } catch (error) {
      next(error instanceof Error ? error : new Error('Unable to scope inserted tenant documents.'));
    }
  });

  schema.pre('deleteOne', { document: true, query: false }, function () {
    const scope = getCenterScope();
    if (!scope) throw new MissingCenterScopeError(this.constructor.name);
    if (scope.kind === 'system') return;
    const documentCenterId = this.get('centerId');
    if (!documentCenterId || String(documentCenterId) !== scope.centerId) throw new Error('Cannot delete a document outside the active center.');
  });

  addModelMiddleware(schema, 'bulkWrite', function (next) {
    const scope = getCenterScope();
    if (!scope) { next(new MissingCenterScopeError(schema.options.collection || 'tenant collection')); return; }
    if (scope.kind === 'system') { next(); return; }
    next(new Error('bulkWrite is disabled for tenant-scoped requests.'));
  });

  for (const operation of QUERY_OPERATIONS) {
    schema.pre(operation, function () {
      const scope = getCenterScope();
      if (!scope) throw new MissingCenterScopeError(this.model.modelName);
      if (scope.kind === 'system') return;

      const centerId = requireCenterId(this.model.modelName);
      const filter = this.getFilter() as Record<string, unknown>;
      this.setQuery(scopeFilter(filter, centerId));

      const update = this.getUpdate();
      if (update !== undefined) {
        if (Array.isArray(update)) throw new Error('Aggregation pipeline updates are not allowed on tenant collections.');
        if (operation === 'findOneAndReplace' || operation === 'replaceOne') {
          const replacement = update as Record<string, unknown>;
          if (replacement.centerId && String(replacement.centerId) !== centerId) throw new Error('Tenant updates cannot change centerId.');
          this.setUpdate({ ...replacement, centerId });
        } else {
          if (containsCenterWrite(update)) throw new Error('Tenant updates cannot change centerId.');
          if (this.getOptions().upsert) this.setUpdate(addCenterToUpsert(update, centerId));
        }
      }
    });
  }

  schema.pre('aggregate', function () {
    const scope = getCenterScope();
    if (!scope) throw new MissingCenterScopeError(schema.options.collection || 'tenant collection');
    if (scope.kind === 'system') return;
    const centerId = requireCenterId(schema.options.collection || 'tenant collection');
    const centerObjectId = new mongoose.Types.ObjectId(centerId);
    const pipeline = this.pipeline();
    const match = { $match: { centerId: centerObjectId } };
    if (pipeline[0] && ('$geoNear' in pipeline[0] || '$search' in pipeline[0] || '$vectorSearch' in pipeline[0])) {
      pipeline.splice(1, 0, match);
    } else if (pipeline[0] && '$changeStream' in pipeline[0]) {
      pipeline.splice(1, 0, { $match: { 'fullDocument.centerId': centerObjectId } });
    } else {
      pipeline.unshift(match);
    }
  });
}

export function sharedCenterCatalogPlugin(schema: Schema) {
  preventRecreationAfterDeletion(schema);
  schema.add({ centerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Center', required: false, index: true } });

  schema.pre('save', function () {
    const scope = getCenterScope();
    if (!scope) throw new MissingCenterScopeError(this.constructor.name);
    if (scope.kind === 'system') return;
    const current = this.get('centerId');
    if (current && String(current) !== scope.centerId) throw new Error('A tenant document cannot be moved between centers.');
    if (this.isNew || current) this.set('centerId', scope.centerId);
  });

  addModelMiddleware(schema, 'insertMany', function (next, value) {
    try {
      const scope = getCenterScope();
      if (!scope) throw new MissingCenterScopeError(schema.options.collection || 'shared catalog');
      if (scope.kind === 'system') { next(); return; }
      const documents = value as Array<Record<string, unknown>>;
      for (const document of documents) {
        if (document.centerId && String(document.centerId) !== scope.centerId) throw new Error('A catalog document cannot be moved between centers.');
        document.centerId = scope.centerId;
      }
      next();
    } catch (error) {
      next(error instanceof Error ? error : new Error('Unable to scope inserted catalog documents.'));
    }
  });

  schema.pre('deleteOne', { document: true, query: false }, function () {
    const scope = getCenterScope();
    if (!scope) throw new MissingCenterScopeError(this.constructor.name);
    if (scope.kind === 'system') return;
    const documentCenterId = this.get('centerId');
    if (!documentCenterId || String(documentCenterId) !== scope.centerId) throw new Error('Shared catalog entries cannot be deleted by a center.');
  });

  addModelMiddleware(schema, 'bulkWrite', function (next) {
    const scope = getCenterScope();
    if (!scope) { next(new MissingCenterScopeError(schema.options.collection || 'shared catalog')); return; }
    if (scope.kind === 'system') { next(); return; }
    next(new Error('bulkWrite is disabled for center catalog requests.'));
  });

  for (const operation of QUERY_OPERATIONS) {
    schema.pre(operation, function () {
      const scope = getCenterScope();
      if (!scope) throw new MissingCenterScopeError(this.model.modelName);
      if (scope.kind === 'system') return;
      const centerId = requireCenterId(this.model.modelName);
      if (!['countDocuments', 'distinct', 'find', 'findOne'].includes(operation)) {
        throw new Error('Tenant catalog writes must use a center-owned document operation.');
      }
      const centerObjectId = new mongoose.Types.ObjectId(centerId);
      const filter = this.getFilter() as Record<string, unknown>;
      this.setQuery({ $and: [filter, { $or: [{ centerId: centerObjectId }, { centerId: null }, { centerId: { $exists: false } }] }] });

      const update = this.getUpdate();
      if (update === undefined) return;
      if (Array.isArray(update)) throw new Error('Aggregation pipeline updates are not allowed on center catalogs.');
      if (operation === 'findOneAndReplace' || operation === 'replaceOne') {
        const replacement = update as Record<string, unknown>;
        if (replacement.centerId && String(replacement.centerId) !== centerId) throw new Error('Catalog updates cannot change centerId.');
        this.setUpdate({ ...replacement, centerId });
      } else {
        if (containsCenterWrite(update)) throw new Error('Catalog updates cannot change centerId.');
        if (this.getOptions().upsert) this.setUpdate(addCenterToUpsert(update, centerId));
      }
    });
  }

  schema.pre('aggregate', function () {
    const scope = getCenterScope();
    if (!scope) throw new MissingCenterScopeError(schema.options.collection || 'shared catalog');
    if (scope.kind === 'system') return;
    const centerId = new mongoose.Types.ObjectId(requireCenterId(schema.options.collection || 'shared catalog'));
    const pipeline = this.pipeline();
    const match = { $match: { $or: [{ centerId }, { centerId: null }, { centerId: { $exists: false } }] } };
    if (pipeline[0] && ('$geoNear' in pipeline[0] || '$search' in pipeline[0] || '$vectorSearch' in pipeline[0])) pipeline.splice(1, 0, match);
    else if (pipeline[0] && '$changeStream' in pipeline[0]) pipeline.splice(1, 0, { $match: { $or: [{ 'fullDocument.centerId': centerId }, { 'fullDocument.centerId': null }, { 'fullDocument.centerId': { $exists: false } }] } });
    else pipeline.unshift(match);
  });
}
