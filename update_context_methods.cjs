const fs = require('fs');
let code = fs.readFileSync('src/context/AppContext.tsx', 'utf-8');

// Add to context type
const typeOld = `  custosFixos: CustoFixoItem[];
  setCustosFixos: (cf: CustoFixoItem[]) => void;
  produtos: ProdutoItem[];
  setProdutos: (p: ProdutoItem[]) => void;`;
const typeNew = `  custosFixos: CustoFixoItem[];
  setCustosFixos: (cf: CustoFixoItem[]) => void;
  produtos: ProdutoItem[];
  setProdutos: (p: ProdutoItem[]) => void;
  saveProduto: (p: ProdutoItem) => Promise<void>;
  removeProduto: (id: string) => Promise<void>;
  saveCustoFixo: (c: CustoFixoItem) => Promise<void>;
  removeCustoFixo: (id: string) => Promise<void>;`;
code = code.replace(typeOld, typeNew);

const returnOld = `    <AppContext.Provider value={{ 
      user, login, logout, isGuest, setGuestMode,
      custosFixos, setCustosFixos,
      produtos, setProdutos
    }}>`;
const returnNew = `    <AppContext.Provider value={{ 
      user, login, logout, isGuest, setGuestMode,
      custosFixos, setCustosFixos,
      produtos, setProdutos,
      saveProduto, removeProduto,
      saveCustoFixo, removeCustoFixo
    }}>`;
code = code.replace(returnOld, returnNew);

const methods = `
  const saveProduto = async (p: ProdutoItem) => {
    if (user && !isGuest) {
      const isExisting = produtos.find(prod => prod.id === p.id);
      const url = isExisting ? \`/api/products/\${p.id}\` : '/api/products';
      const method = isExisting ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar produto");
      
      setProdutos(prev => {
        if (isExisting) return prev.map(prod => prod.id === p.id ? data.product : prod);
        return [...prev, data.product || data];
      });
    } else {
      setProdutos(prev => {
        const isExisting = prev.find(prod => prod.id === p.id);
        if (isExisting) return prev.map(prod => prod.id === p.id ? p : prod);
        return [...prev, p];
      });
    }
  };

  const removeProduto = async (id: string) => {
    if (user && !isGuest) {
      const res = await fetch(\`/api/products/\${id}\`, { method: 'DELETE' });
      if (!res.ok) throw new Error("Erro ao excluir produto");
    }
    setProdutos(prev => prev.filter(p => p.id !== id));
  };

  const saveCustoFixo = async (c: CustoFixoItem) => {
    if (user && !isGuest) {
      const isExisting = custosFixos.find(cust => cust.id === c.id);
      const url = isExisting ? \`/api/fixed-costs/\${c.id}\` : '/api/fixed-costs';
      const method = isExisting ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar custo fixo");
      
      setCustosFixos(prev => {
        if (isExisting) return prev.map(cust => cust.id === c.id ? data.cost : cust);
        return [...prev, data.cost || data];
      });
    } else {
      setCustosFixos(prev => {
        const isExisting = prev.find(cust => cust.id === c.id);
        if (isExisting) return prev.map(cust => cust.id === c.id ? c : cust);
        return [...prev, c];
      });
    }
  };

  const removeCustoFixo = async (id: string) => {
    if (user && !isGuest) {
      const res = await fetch(\`/api/fixed-costs/\${id}\`, { method: 'DELETE' });
      if (!res.ok) throw new Error("Erro ao excluir custo fixo");
    }
    setCustosFixos(prev => prev.filter(c => c.id !== id));
  };
`;

code = code.replace(/return \(\s*<AppContext\.Provider/, methods + '\n  return (\n    <AppContext.Provider');

fs.writeFileSync('src/context/AppContext.tsx', code);
