import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from './index.js';

export async function runMigrations() {
  console.log('Running database migrations...');
  try {
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('Migrations complete!');
  } catch (err) {
    console.error('Error running migrations:', err);
  }
}
