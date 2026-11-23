import { Pool } from '@neondatabase/serverless';
import { drizzle, type NeonDatabase } from 'drizzle-orm/neon-serverless';
import * as schema from './schema/index.js';

export type AppDatabase = NeonDatabase<typeof schema>;

let dbInstance: AppDatabase | null = null;
let poolInstance: Pool | null = null;

export function getDatabase(connectionString?: string): AppDatabase {
  if (dbInstance) return dbInstance;

  const conn = connectionString ?? process.env.DATABASE_URL;
  if (!conn) {
    throw new Error('DATABASE_URL environment variable is required to initialize database client.');
  }

  poolInstance = new Pool({ connectionString: conn });
  dbInstance = drizzle({ client: poolInstance, schema });
  return dbInstance;
}

export async function closeDatabase(): Promise<void> {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
    dbInstance = null;
  }
}
