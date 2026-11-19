import dotenv from 'dotenv';
import { loadEnv } from './config/env.js';

dotenv.config({ quiet: true });
const env = loadEnv();

// Local development applies pending migrations before the API starts. Production
// migrations run once as a deployment job, not independently in every API replica.
if (env.NODE_ENV === 'development' || process.env.GYM_EMBEDDED === '1') {
  const [{ connectDatabase }, { runMigrations }] = await Promise.all([
    import('./config/db.js'),
    import('./services/migrationService.js'),
  ]);
  await connectDatabase();
  const result = await runMigrations();
  console.info(result.applied.length
    ? `Applied database migrations: ${result.applied.join(', ')}`
    : 'Database migrations are up to date.');
}

await import('./server.js');
