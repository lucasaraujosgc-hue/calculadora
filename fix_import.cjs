const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const importOld = `      const products = await getAllProducts();
      const imported: any[] = [];
      const errors: any[] = [];

      rows.forEach((row, i) => {
        const nome = row.nome || row.Nome || row.produto || row.Produto;
        const precoCusto = row.preco_custo ?? row["Preço de Custo"] ?? row.custo;
        const precoVenda = row.preco_venda ?? row["Preço de Venda"] ?? row.preco;

        if (!nome || precoCusto == null) {
          errors.push({ linha: i + 2, motivo: "Faltando nome ou preço de custo" });
          return;
        }`;

const importNew = `      const products = await getAllProducts();
      const userProducts = products.filter((p: any) => p.ownerEmail === req.currentUser.email && !p.isSample);
      const currentCount = userProducts.length;
      const limit = req.currentUser.plan === 'ilimitado' ? Infinity : (req.currentUser.productLimit || 7);
      
      const imported: any[] = [];
      const errors: any[] = [];
      const validRows: any[] = [];

      rows.forEach((row, i) => {
        const nome = row.nome || row.Nome || row.produto || row.Produto;
        const precoCusto = row.preco_custo ?? row["Preço de Custo"] ?? row.custo;
        const precoVenda = row.preco_venda ?? row["Preço de Venda"] ?? row.preco;

        if (!nome || precoCusto == null || isNaN(Number(precoCusto))) {
          errors.push({ linha: i + 2, motivo: "Faltando nome ou preço de custo inválido" });
          return;
        }
        validRows.push({nome, precoCusto, precoVenda});
      });

      if (currentCount + validRows.length > limit) {
        return res.status(403).json({
          error: \`Limite excedido. Você possui \${currentCount} produtos de um limite de \${limit}. A planilha contém \${validRows.length} produtos válidos. A importação não pode ser realizada.\`
        });
      }

      validRows.forEach(row => {
        const { nome, precoCusto, precoVenda } = row;`;

code = code.replace(importOld, importNew);
fs.writeFileSync('server.ts', code);
