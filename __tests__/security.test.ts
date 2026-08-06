import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { app } from '../server.ts';
import { db } from '../src/db/index.js';

vi.mock('../src/db/index.js', () => {
  const selectMock = vi.fn();
  return {
    db: {
      select: selectMock,
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    }
  };
});

describe('Security Rules & Isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('login should apply rate limiting', async () => {
    let res;
    for (let i = 0; i < 22; i++) {
      res = await request(app).post('/api/login').send({ email: 'test@example.com', password: 'password' });
    }
    expect(res.status).toBe(429);
  });

  it('webhook should be idempotent', async () => {
    const mockWhere = vi.fn().mockResolvedValue([{ id: 1, eventId: 'evt_123', status: 'processed' }]);
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    const mockedDb = vi.mocked(db, true);
    mockedDb.select.mockReturnValue({ from: mockFrom } as any);

    const payload = JSON.stringify({ id: 'evt_123', type: 'order.paid' });
    const secret = process.env.PAGARME_WEBHOOK_SECRET || '';
    const hash = crypto.createHmac('sha1', secret).update(payload).digest('hex');
    const signature = `sha1=${hash}`;

    const res = await request(app)
      .post('/api/webhooks/pagarme')
      .set('x-pagarme-webhook-signature', signature)
      .send(payload)
      .set('Content-Type', 'application/json');
      
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: "Evento já processado." });
    expect(mockedDb.insert).not.toHaveBeenCalled();
  });

  it('should isolate user data by user_id', async () => {
    const userId = 999;
    const email = 'test@example.com';
    const token = jwt.sign({ email }, process.env.JWT_SECRET || 'super_secret_key_123');
    
    const mockedDb = vi.mocked(db, true);
    
    // First db.select() is for requireUser
    // Second db.select() is for /api/products
    const mockWhere = vi.fn()
      .mockResolvedValueOnce([{ id: userId, email }])
      .mockResolvedValueOnce([{
        id: 1, name: 'Produto 1', costPrice: 10, salePrice: 25,
        projectedSales: 50, isSample: false, userId
      }]);
      
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    mockedDb.select.mockReturnValue({ from: mockFrom } as any);
    
    const res = await request(app)
      .get('/api/products')
      .set('Cookie', [`user_token=${token}`]);
      
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{
      id: 1, nome: 'Produto 1', cmv: 10, precoVenda: 25,
      vendasProjetadas: 50, isSample: false
    }]);
    expect(res.body[0]).not.toHaveProperty('userId');
    expect(mockedDb.select).toHaveBeenCalled();
  });
});
