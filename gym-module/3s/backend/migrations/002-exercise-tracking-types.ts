import mongoose from 'mongoose';

interface ChangedDocument { id: string; paths: string[] }
export interface ExerciseTrackingMigrationMetadata extends Record<string, unknown> {
  counts: Record<'exercises' | 'workoutTemplates' | 'workoutPlans', { matched: number; modified: number }>;
  changes: Array<{ collection: string; documents: ChangedDocument[] }>;
}

const missing = (record: Record<string, unknown>, key: string) => !Object.prototype.hasOwnProperty.call(record, key) || record[key] == null;

function classifyNestedExercises(document: Record<string, any>) {
  const paths: string[] = [];
  const touch = (items: Array<Record<string, any>> | undefined, prefix: string) => {
    for (const [index, item] of (items || []).entries()) {
      if (missing(item, 'trackingType')) {
        item.trackingType = 'UNCLASSIFIED';
        paths.push(`${prefix}.${index}.trackingType`);
      }
    }
  };
  touch(document.scheduledExercises, 'scheduledExercises');
  touch(document.unscheduledExercises, 'unscheduledExercises');
  for (const [sessionIndex, session] of (document.sessions || []).entries()) touch(session.exercises, `sessions.${sessionIndex}.exercises`);
  return paths;
}

async function migrateNestedCollection(collectionName: string, dryRun: boolean) {
  const collection = mongoose.connection.collection(collectionName);
  const documents = await collection.find({}, { projection: { scheduledExercises: 1, unscheduledExercises: 1, sessions: 1 } }).toArray();
  const changes: ChangedDocument[] = [];
  let modified = 0;
  for (const document of documents) {
    const paths = classifyNestedExercises(document);
    if (!paths.length) continue;
    changes.push({ id: String(document._id), paths });
    if (!dryRun) {
      const update: Record<string, unknown> = {};
      if (paths.some((path) => path.startsWith('scheduledExercises.'))) update.scheduledExercises = document.scheduledExercises;
      if (paths.some((path) => path.startsWith('unscheduledExercises.'))) update.unscheduledExercises = document.unscheduledExercises;
      if (paths.some((path) => path.startsWith('sessions.'))) update.sessions = document.sessions;
      const result = await collection.updateOne({ _id: document._id }, { $set: update });
      modified += result.modifiedCount;
    } else modified += 1;
  }
  return { changes, count: { matched: changes.length, modified } };
}

export async function upExerciseTrackingTypes({ dryRun = false } = {}): Promise<ExerciseTrackingMigrationMetadata> {
  const exercises = mongoose.connection.collection('exercises');
  const exerciseDocuments = await exercises.find({ $or: [{ defaultTrackingType: { $exists: false } }, { defaultTrackingType: null }] }, { projection: { _id: 1 } }).toArray();
  const exerciseChanges = exerciseDocuments.map((document) => ({ id: String(document._id), paths: ['defaultTrackingType'] }));
  let exerciseModified = exerciseDocuments.length;
  if (!dryRun && exerciseDocuments.length) {
    const result = await exercises.updateMany({ _id: { $in: exerciseDocuments.map((document) => document._id) } }, { $set: { defaultTrackingType: 'UNCLASSIFIED' } });
    exerciseModified = result.modifiedCount;
  }

  const templates = await migrateNestedCollection('workouttemplates', dryRun);
  const plans = await migrateNestedCollection('workoutplans', dryRun);
  return {
    counts: {
      exercises: { matched: exerciseDocuments.length, modified: exerciseModified },
      workoutTemplates: templates.count,
      workoutPlans: plans.count,
    },
    changes: [
      { collection: 'exercises', documents: exerciseChanges },
      { collection: 'workouttemplates', documents: templates.changes },
      { collection: 'workoutplans', documents: plans.changes },
    ],
  };
}

export async function downExerciseTrackingTypes(metadata: Record<string, unknown>) {
  const changes = (metadata.changes || []) as ExerciseTrackingMigrationMetadata['changes'];
  for (const change of changes) {
    const collection = mongoose.connection.collection(change.collection);
    for (const document of change.documents) {
      const unset = Object.fromEntries(document.paths.map((path) => [path, '']));
      await collection.updateOne({ _id: new mongoose.Types.ObjectId(document.id) }, { $unset: unset });
    }
  }
}
