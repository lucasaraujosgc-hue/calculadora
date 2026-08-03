import { db } from './index.js';
import { store, products, payments, webhookEvents, users, fixedCosts, courses, leads } from './schema.js';
import crypto from 'crypto';

async function runMigration() {
  console.log("Iniciando migração (Parte 2)...");
  
  // Limpando o store antigo para não confundir o server_part1.ts
  try {
    const keysToClean = ['products', 'users', 'fixed_costs', 'payments', 'courses', 'leads', 'webhook_events'];
    for (const key of keysToClean) {
      await db.delete(store).where({ key: key } as any);
      console.log(`Limpou a chave ${key} do store.`);
    }
  } catch (err) {
    console.log("Erro ao limpar store antigo:", err);
  }
  
  console.log("Migração de limpeza do store concluída.");
}

runMigration().catch(console.error);
