import fs from 'fs';
import path from 'path';
import pkg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';

const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

async function migrate() {
  await db.execute(sql`CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY, value JSONB NOT NULL)`);
  
  const files = fs.readdirSync('data').filter(f => f.endsWith('.json'));
  for (const file of files) {
    const key = file.replace('.json', '');
    const data = JSON.parse(fs.readFileSync(path.join('data', file), 'utf-8'));
    console.log(`Migrating \${key}...`);
    await db.execute(sql`
      INSERT INTO store (key, value)
      VALUES (\${key}, \${JSON.stringify(data)})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `);
  }
  console.log('Migration complete.');
  process.exit(0);
}

migrate().catch(console.error);
