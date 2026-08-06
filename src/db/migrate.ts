import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from './index.js';

export async function runMigrations() {
  console.log('Running database migrations...');
  // Não engolir o erro: se a migration falhar (banco fora do ar, DATABASE_URL
  // errado, permissão insuficiente etc.) o app não deve continuar subindo
  // como se nada tivesse acontecido.
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('Migrations complete!');
}
