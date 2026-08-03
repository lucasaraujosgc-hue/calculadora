import { db } from './index.js';
import { store, users, products, fixedCosts, payments, courses, leads, webhookEvents } from './schema.js';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

async function migrateData() {
  console.log("Iniciando migração de dados do store para tabelas relacionais...");

  try {
    // 1. LER DADOS ANTIGOS
    const storeUsersRes = await db.select().from(store).where(eq(store.key, 'users'));
    const oldUsers = storeUsersRes.length > 0 ? storeUsersRes[0].value as any[] : [];

    const storeProductsRes = await db.select().from(store).where(eq(store.key, 'products'));
    const oldProducts = storeProductsRes.length > 0 ? storeProductsRes[0].value as any[] : [];

    const storeFixedCostsRes = await db.select().from(store).where(eq(store.key, 'fixed_costs'));
    const oldFixedCosts = storeFixedCostsRes.length > 0 ? storeFixedCostsRes[0].value as any[] : [];

    const storePaymentsRes = await db.select().from(store).where(eq(store.key, 'payments'));
    const oldPayments = storePaymentsRes.length > 0 ? storePaymentsRes[0].value as any[] : [];

    const storeCoursesRes = await db.select().from(store).where(eq(store.key, 'courses'));
    const oldCourses = storeCoursesRes.length > 0 ? storeCoursesRes[0].value as any[] : [];

    const storeLeadsRes = await db.select().from(store).where(eq(store.key, 'leads'));
    const oldLeads = storeLeadsRes.length > 0 ? storeLeadsRes[0].value as any[] : [];

    const storeWebhookEventsRes = await db.select().from(store).where(eq(store.key, 'webhook_events'));
    const oldWebhookEvents = storeWebhookEventsRes.length > 0 ? storeWebhookEventsRes[0].value as any[] : [];

    // Mapas para manter correspondência de IDs
    const userEmailToId = new Map<string, string>();

    // 2. CONVERTER E INSERIR USUÁRIOS
    console.log(`Migrando ${oldUsers.length} usuários...`);
    const newUsers = oldUsers.map(u => {
      const id = crypto.randomUUID();
      userEmailToId.set(u.email, id);
      return {
        id,
        name: u.name || u.email.split('@')[0],
        email: u.email,
        passwordHash: u.password, // Mapeado de 'password' -> 'passwordHash'
        role: u.role || 'user',
        planId: u.plan || 'free',
        resetTokenHash: u.resetToken,
        resetTokenExpiresAt: u.resetTokenExpires ? new Date(u.resetTokenExpires) : null,
      };
    });

    if (newUsers.length > 0) {
      await db.insert(users).values(newUsers).onConflictDoNothing();
    }

    // 3. CONVERTER E INSERIR PRODUTOS
    console.log(`Migrando ${oldProducts.length} produtos...`);
    const newProducts = [];
    for (const p of oldProducts) {
      const userId = userEmailToId.get(p.ownerEmail);
      if (userId) {
        newProducts.push({
          id: p.id || crypto.randomUUID(),
          userId,
          name: p.name,
          costPrice: p.costPrice || p.custo || 0,
          salePrice: p.salePrice || p.precoVenda || 0,
          projectedSales: p.projectedSales || p.vendasProjetadas || 0,
          isSample: p.isSample || false,
          createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
        });
      }
    }
    if (newProducts.length > 0) {
      await db.insert(products).values(newProducts).onConflictDoNothing();
    }

    // 4. CONVERTER E INSERIR CUSTOS FIXOS
    console.log(`Migrando ${oldFixedCosts.length} custos fixos...`);
    const newFixedCosts = [];
    for (const c of oldFixedCosts) {
      const userId = userEmailToId.get(c.ownerEmail);
      if (userId) {
        newFixedCosts.push({
          id: c.id || crypto.randomUUID(),
          userId,
          name: c.name || c.nome,
          amount: c.amount || c.valor || 0,
        });
      }
    }
    if (newFixedCosts.length > 0) {
      await db.insert(fixedCosts).values(newFixedCosts).onConflictDoNothing();
    }

    // 5. CONVERTER E INSERIR PAGAMENTOS
    console.log(`Migrando ${oldPayments.length} pagamentos...`);
    const newPayments = [];
    for (const p of oldPayments) {
      const userId = userEmailToId.get(p.email);
      if (userId) {
        newPayments.push({
          id: p.id || crypto.randomUUID(),
          userId,
          planId: p.planId,
          orderCode: p.orderCode || p.code || null,
          paymentLinkId: p.paymentLinkId || null,
          status: p.status || 'pending',
          amount: p.amount || 0,
          createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
        });
      }
    }
    if (newPayments.length > 0) {
      await db.insert(payments).values(newPayments).onConflictDoNothing();
    }

    // 6. CONVERTER E INSERIR CURSOS
    console.log(`Migrando ${oldCourses.length} cursos...`);
    const mappedCourses = oldCourses.map(c => ({
      id: c.id || crypto.randomUUID(),
      title: c.title,
      description: c.description,
      videoUrl: c.videoUrl,
      thumbnailUrl: c.thumbnailUrl || null,
    }));
    if (mappedCourses.length > 0) {
      await db.insert(courses).values(mappedCourses).onConflictDoNothing();
    }

    // 7. CONVERTER E INSERIR LEADS
    console.log(`Migrando ${oldLeads.length} leads...`);
    const mappedLeads = oldLeads.map(l => ({
      id: l.id || crypto.randomUUID(),
      name: l.name,
      email: l.email,
      phone: l.phone || null,
      createdAt: l.createdAt ? new Date(l.createdAt) : new Date(),
    }));
    if (mappedLeads.length > 0) {
      await db.insert(leads).values(mappedLeads).onConflictDoNothing();
    }

    // 8. CONVERTER E INSERIR EVENTOS DE WEBHOOK
    console.log(`Migrando ${oldWebhookEvents.length} webhook events...`);
    const mappedWebhookEvents = oldWebhookEvents.map(w => ({
      id: w.id || crypto.randomUUID(),
      eventId: w.eventId,
      eventType: w.eventType,
      status: w.status || 'processed',
      receivedAt: w.receivedAt ? new Date(w.receivedAt) : new Date(),
      processedAt: w.processedAt ? new Date(w.processedAt) : null,
      errorMessage: w.errorMessage || null,
    }));
    if (mappedWebhookEvents.length > 0) {
      await db.insert(webhookEvents).values(mappedWebhookEvents).onConflictDoNothing();
    }

    // 9. VALIDAÇÃO E RELATÓRIO
    console.log("\n--- RESULTADO DA MIGRAÇÃO ---");
    const dbUsersCount = (await db.select().from(users)).length;
    console.log(`Usuários: ${oldUsers.length} antigo(s) -> ${dbUsersCount} novo(s)`);
    
    const dbProductsCount = (await db.select().from(products)).length;
    console.log(`Produtos: ${oldProducts.length} antigo(s) -> ${dbProductsCount} novo(s) (Nota: amostras que não tem dono podem ter sido ignoradas)`);

    const dbFixedCostsCount = (await db.select().from(fixedCosts)).length;
    console.log(`Custos Fixos: ${oldFixedCosts.length} antigo(s) -> ${dbFixedCostsCount} novo(s)`);

    const dbPaymentsCount = (await db.select().from(payments)).length;
    console.log(`Pagamentos: ${oldPayments.length} antigo(s) -> ${dbPaymentsCount} novo(s)`);

    const dbCoursesCount = (await db.select().from(courses)).length;
    console.log(`Cursos: ${oldCourses.length} antigo(s) -> ${dbCoursesCount} novo(s)`);

    const dbLeadsCount = (await db.select().from(leads)).length;
    console.log(`Leads: ${oldLeads.length} antigo(s) -> ${dbLeadsCount} novo(s)`);

    const dbWebhookEventsCount = (await db.select().from(webhookEvents)).length;
    console.log(`Eventos Webhook: ${oldWebhookEvents.length} antigo(s) -> ${dbWebhookEventsCount} novo(s)`);

    console.log("Migração concluída.");
  } catch(e) {
    console.error("Erro na migração:", e);
  }
}

// migrateData();
export { migrateData };
