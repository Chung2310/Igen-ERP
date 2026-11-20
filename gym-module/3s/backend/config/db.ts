import mongoose, { type ConnectOptions } from 'mongoose';

type MongoEnvironmentKey =
  | 'MONGODB_URI'
  | 'MONGODB_USER'
  | 'MONGODB_PASSWORD'
  | 'MONGODB_AUTH_SOURCE';

export type MongoEnvironment = Partial<Record<MongoEnvironmentKey, string>>;

export interface MongoConnectionConfiguration {
  uri: string;
  options: ConnectOptions;
}

export function buildMongoConnectionOptions(
  env: MongoEnvironment,
): MongoConnectionConfiguration {
  const uri = env.MONGODB_URI?.trim();
  if (!uri) throw new Error('MONGODB_URI là bắt buộc.');

  const user = env.MONGODB_USER?.trim();
  const password = env.MONGODB_PASSWORD?.trim();
  if (Boolean(user) !== Boolean(password)) {
    throw new Error('MONGODB_USER và MONGODB_PASSWORD phải được cấu hình cùng nhau.');
  }

  if (!user || !password) return { uri, options: {} };

  return {
    uri,
    options: {
      user,
      pass: password,
      authSource: env.MONGODB_AUTH_SOURCE?.trim() || 'admin',
    },
  };
}

export async function connectDatabase(
  env: MongoEnvironment = process.env,
): Promise<typeof mongoose.connection> {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  const { uri, options } = buildMongoConnectionOptions(env);
  await mongoose.connect(uri, options);
  return mongoose.connection;
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}
