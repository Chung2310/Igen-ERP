import type { Application } from 'express';

/** Start Gym inside the ERP process, with its own models in ERP's database. */
export async function startEmbeddedGym(): Promise<Application> {
  const secret = process.env.GYM_BRIDGE_SECRET?.trim();
  if (!secret || secret.length < 32) throw new Error('GYM_BRIDGE_SECRET must contain at least 32 characters.');

  process.env.GYM_EMBEDDED = '1';
  process.env.GYM_SHARED_DB = '1';
  process.env.JWT_SECRET ||= secret;
  process.env.GYM_ERP_API_URL ||= `http://127.0.0.1:${process.env.PORT || '3000'}`;
  process.env.MONGODB_URI ||= 'mongodb://mongodb/igen-erp';
  // Configure the collection namespace before any Gym model is imported.
  await import('./config/collectionNamespace.js');
  const [{ connectDatabase }, { runMigrations, migrationStatus }] = await Promise.all([
    import('./config/db.js'),
    import('./services/migrationService.js'),
  ]);
  await connectDatabase();
  await runMigrations();
  const migrations = await migrationStatus();
  for (const version of ['004-center-tenancy', '005-ai-usage-quota-counters', '006-center-workspace-types', '007-pt-onboarding-and-ai-recovery', '008-ai-company-global-budget']) {
    if (!migrations.some((migration) => migration.version === version && migration.status === 'APPLIED')) {
      throw new Error(`Gym migration ${version} is not applied.`);
    }
  }

  const [{ default: app }, workout, nutrition, alerts, deletion, recovery] = await Promise.all([
    import('./app.js'),
    import('./services/aiWorkoutGenerationJobService.js'),
    import('./services/aiNutritionGenerationJobService.js'),
    import('./services/packageAlertScheduler.js'),
    import('./services/deletionMediaService.js'),
    import('./services/aiReservationRecoveryService.js'),
  ]);
  await workout.startAiWorkoutGenerationWorker();
  await nutrition.startAiNutritionGenerationWorker();
  await alerts.startPackageAlertScheduler();
  deletion.startDeletionMediaWorker();
  recovery.startAiReservationRecovery();
  return app;
}
