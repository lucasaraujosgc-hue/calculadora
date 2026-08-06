const fs = require('fs');
let code = fs.readFileSync('__tests__/security.test.ts', 'utf8');

const target = `  it('should isolate user data by user_id', async () => {
    const userId = 999;
    const email = 'test@example.com';
    const token = jwt.sign({ email }, process.env.JWT_SECRET || 'super_secret_key_123');
    
    // First db.select() is for requireUser
    // Second db.select() is for /api/products
    const mockWhere = vi.fn()
      .mockResolvedValueOnce([{ id: userId, email }])
      .mockResolvedValueOnce([{ id: 1, name: 'Produto 1', userId }]);
      
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    db.select.mockReturnValue({ from: mockFrom });
    
    const res = await request(app)
      .get('/api/products')
      .set('Cookie', [\`user_token=\${token}\`]);
      
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 1, name: 'Produto 1', userId }]);
    expect(db.select).toHaveBeenCalled();
  });`;

const replacement = `  it('should isolate user data by user_id', async () => {
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
      .set('Cookie', [\`user_token=\${token}\`]);
      
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{
      id: 1, nome: 'Produto 1', cmv: 10, precoVenda: 25,
      vendasProjetadas: 50, isSample: false
    }]);
    expect(res.body[0]).not.toHaveProperty('userId');
    expect(mockedDb.select).toHaveBeenCalled();
  });`;

const replaced = code.replace(target, replacement);

// Also fix idempotency test typing
code = replaced.replace(
  `db.select.mockReturnValue({ from: mockFrom });`,
  `const mockedDb = vi.mocked(db, true);\n    mockedDb.select.mockReturnValue({ from: mockFrom } as any);`
).replace(`expect(db.insert).not.toHaveBeenCalled();`, `expect(mockedDb.insert).not.toHaveBeenCalled();`);

fs.writeFileSync('__tests__/security.test.ts', code);
