const fs = require('fs');

// AppContext.tsx
let ctx = fs.readFileSync('src/context/AppContext.tsx', 'utf-8');
const syncMethodTypeOld = `  saveProduto: (p: ProdutoItem) => Promise<void>;`;
const syncMethodTypeNew = `  setProdutos: React.Dispatch<React.SetStateAction<ProdutoItem[]>>;
  saveProduto: (p: ProdutoItem) => Promise<void>;
  syncProdutos: (ps: ProdutoItem[]) => Promise<void>;`;
// Note: setProdutos is already in the type, but let's make sure.
// Wait, the type is: `setProdutos: (p: ProdutoItem[]) => void;`
// Let's just add `syncProdutos: (ps: ProdutoItem[]) => Promise<void>;`

ctx = ctx.replace(`saveProduto: (p: ProdutoItem) => Promise<void>;`, `saveProduto: (p: ProdutoItem) => Promise<void>;\n  syncProdutos: (ps: ProdutoItem[]) => Promise<void>;`);

const syncMethodImpl = `  const syncProdutos = async (ps: ProdutoItem[]) => {
    if (user && !isGuest) {
      const res = await fetch('/api/products/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ps)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro ao sincronizar produtos");
      }
      const data = await res.json();
      // Data might be slightly different shaped (backend sends back the updated array).
      // Since it's a sync, it's probably best to just set them:
      setProdutos(ps); 
    } else {
      setProdutos(ps);
    }
  };`;

ctx = ctx.replace(/const removeProduto = async/, syncMethodImpl + '\n\n  const removeProduto = async');
ctx = ctx.replace(/saveProduto, removeProduto,/, 'saveProduto, removeProduto, syncProdutos,');
fs.writeFileSync('src/context/AppContext.tsx', ctx);

// CustosVariaveis.tsx
let cv = fs.readFileSync('src/pages/CustosVariaveis.tsx', 'utf-8');
cv = cv.replace(/const \{ user, produtos, saveProduto, removeProduto, isGuest \} = useAppContext\(\);/, 'const { user, produtos, setProdutos, saveProduto, removeProduto, isGuest } = useAppContext();');
fs.writeFileSync('src/pages/CustosVariaveis.tsx', cv);

// MixPrecoLote.tsx
let mpl = fs.readFileSync('src/pages/MixPrecoLote.tsx', 'utf-8');
mpl = mpl.replace('const { produtos, custosFixos, setProdutos } = useAppContext();', 'const { produtos, custosFixos, setProdutos, syncProdutos } = useAppContext();');
mpl = mpl.replace(/setProdutos\(updated\);/g, 'setProdutos(updated); syncProdutos(updated).catch(err => console.error(err));');
fs.writeFileSync('src/pages/MixPrecoLote.tsx', mpl);

