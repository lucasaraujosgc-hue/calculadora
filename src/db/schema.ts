import { pgTable, text, jsonb, timestamp, doublePrecision, boolean, uuid, varchar, integer, index, unique } from 'drizzle-orm/pg-core';

export const store = pgTable('store', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
});

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').default('user').notNull(),
  planId: text('plan_id').default('free').notNull(),
  // CNPJ ou CPF da empresa, só dígitos. É o que diz, na importação de XML, se a
  // nota é de compra (a empresa é a destinatária) ou de venda (é a emitente).
  taxId: varchar('tax_id', { length: 14 }),
  resetTokenHash: text('reset_token_hash'),
  resetTokenExpiresAt: timestamp('reset_token_expires_at'),
  verificationToken: text('verification_token'),
  isVerified: boolean('is_verified').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const products = pgTable('products', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  name: text('name').notNull(),
  costPrice: doublePrecision('cost_price').notNull(),
  salePrice: doublePrecision('sale_price').notNull(),
  projectedSales: doublePrecision('projected_sales').default(0).notNull(),
  imposto: doublePrecision('imposto').default(0),
  taxaCartao: doublePrecision('taxa_cartao').default(0),
  comissao: doublePrecision('comissao').default(0),
  margem: doublePrecision('margem').default(0),
  precoIdeal: doublePrecision('preco_ideal').default(0),
  precoFixo: doublePrecision('preco_fixo').default(0),
  percentualRateio: doublePrecision('percentual_rateio').default(0),
  modoPrecificacao: text('modo_precificacao').default('margem'),
  isSample: boolean('is_sample').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const fixedCosts = pgTable('fixed_costs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  name: text('name').notNull(),
  amount: doublePrecision('amount').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const payments = pgTable('payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  planId: text('plan_id').notNull(),
  orderCode: text('order_code'),
  paymentLinkId: text('payment_link_id'),
  status: text('status').notNull(),
  amount: doublePrecision('amount').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const courses = pgTable('courses', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  videoUrl: text('video_url').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const leads = pgTable('leads', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const webhookEvents = pgTable('webhook_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: text('event_id').notNull().unique(),
  eventType: text('event_type').notNull(),
  status: text('status').notNull(),
  receivedAt: timestamp('received_at').defaultNow().notNull(),
  processedAt: timestamp('processed_at'),
  errorMessage: text('error_message'),
});

export const snapshots = pgTable('snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  custoFixoTotal: doublePrecision('custo_fixo_total').default(0).notNull(),
  produtos: jsonb('produtos').notNull(),
  custosFixos: jsonb('custos_fixos').notNull(),
  label: text('label')
});

// ---------------------------------------------------------------------------
// Notas fiscais importadas por XML
// ---------------------------------------------------------------------------

/**
 * Cabeçalho de cada NF-e/NFC-e importada. A chave de acesso é única por usuário,
 * então reimportar o mesmo arquivo não duplica nada.
 */
export const fiscalDocuments = pgTable('fiscal_documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  chave: varchar('chave', { length: 44 }).notNull(),
  /** 'compra' quando a empresa é a destinatária, 'venda' quando é a emitente. */
  direcao: text('direcao').notNull(),
  modelo: text('modelo'),
  numero: text('numero'),
  serie: text('serie'),
  dataEmissao: timestamp('data_emissao').notNull(),
  /** AAAA-MM — é por ela que todo o resumo é separado. */
  competencia: varchar('competencia', { length: 7 }).notNull(),
  naturezaOperacao: text('natureza_operacao'),
  emitenteDoc: varchar('emitente_doc', { length: 14 }),
  emitenteNome: text('emitente_nome'),
  destinatarioDoc: varchar('destinatario_doc', { length: 14 }),
  destinatarioNome: text('destinatario_nome'),
  valorTotal: doublePrecision('valor_total').default(0).notNull(),
  nomeArquivo: text('nome_arquivo'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  chaveUnicaPorUsuario: unique('fiscal_documents_user_chave_key').on(t.userId, t.chave),
  porUsuarioCompetencia: index('fiscal_documents_user_competencia_idx').on(t.userId, t.competencia),
}));

/** Itens das notas — é daqui que saem o custo e o preço médio de cada período. */
export const fiscalItems = pgTable('fiscal_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  documentId: uuid('document_id').references(() => fiscalDocuments.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  /** Repetidos do cabeçalho para o resumo não precisar de join. */
  direcao: text('direcao').notNull(),
  competencia: varchar('competencia', { length: 7 }).notNull(),
  numero: integer('numero').default(0).notNull(),
  codigo: text('codigo'),
  ean: text('ean'),
  descricao: text('descricao').notNull(),
  ncm: text('ncm'),
  cfop: text('cfop'),
  unidade: text('unidade'),
  /** 'normal', 'devolucao', 'transferencia', 'remessa' ou 'outro'. */
  natureza: text('natureza').default('normal').notNull(),
  quantidade: doublePrecision('quantidade').default(0).notNull(),
  valorUnitario: doublePrecision('valor_unitario').default(0).notNull(),
  valorProduto: doublePrecision('valor_produto').default(0).notNull(),
  desconto: doublePrecision('desconto').default(0).notNull(),
  frete: doublePrecision('frete').default(0).notNull(),
  seguro: doublePrecision('seguro').default(0).notNull(),
  outros: doublePrecision('outros').default(0).notNull(),
  icms: doublePrecision('icms').default(0).notNull(),
  icmsSt: doublePrecision('icms_st').default(0).notNull(),
  ipi: doublePrecision('ipi').default(0).notNull(),
  pis: doublePrecision('pis').default(0).notNull(),
  cofins: doublePrecision('cofins').default(0).notNull(),
  /** Valor do item já com frete, seguro, outros, IPI e ST, menos o desconto. */
  valorLiquido: doublePrecision('valor_liquido').default(0).notNull(),
  /** GTIN quando existe; senão, a descrição normalizada. */
  chaveProduto: text('chave_produto').notNull(),
  origemChave: text('origem_chave').default('descricao').notNull(),
}, (t) => ({
  porUsuarioProduto: index('fiscal_items_user_produto_idx').on(t.userId, t.chaveProduto),
  porUsuarioCompetencia: index('fiscal_items_user_competencia_idx').on(t.userId, t.competencia),
}));
