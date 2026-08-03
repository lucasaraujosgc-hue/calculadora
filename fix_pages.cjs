const fs = require('fs');

// CustosVariaveis.tsx
let cv = fs.readFileSync('src/pages/CustosVariaveis.tsx', 'utf-8');
cv = cv.replace('const { user, produtos, setProdutos, isGuest } = useAppContext();', 'const { user, produtos, saveProduto, removeProduto, isGuest } = useAppContext();');
cv = cv.replace(/setProdutos\(\[\.\.\.produtos, item\]\);/g, 'saveProduto(item);');
cv = cv.replace(/setProdutos\(produtos\.filter\(p => p\.id !== id\)\);/g, 'removeProduto(id);');
cv = cv.replace(/setProdutos\(\[\]\);/g, 'produtos.forEach(p => removeProduto(p.id));');
fs.writeFileSync('src/pages/CustosVariaveis.tsx', cv);

// CustoFixo.tsx
let cf = fs.readFileSync('src/pages/CustoFixo.tsx', 'utf-8');
cf = cf.replace('const { custosFixos, setCustosFixos } = useAppContext();', 'const { custosFixos, saveCustoFixo, removeCustoFixo } = useAppContext();');
cf = cf.replace(/setCustosFixos\(\[\.\.\.custosFixos, item\]\);/g, 'saveCustoFixo(item);');
cf = cf.replace(/setCustosFixos\(custosFixos\.filter\(c => c\.id !== id\)\);/g, 'removeCustoFixo(id);');
fs.writeFileSync('src/pages/CustoFixo.tsx', cf);

// FormacaoPreco.tsx
let fp = fs.readFileSync('src/pages/FormacaoPreco.tsx', 'utf-8');
fp = fp.replace('const { produtos, custosFixos, setProdutos } = useAppContext();', 'const { produtos, custosFixos, saveProduto } = useAppContext();');
fp = fp.replace(/setProdutos\(updated\);/, 'saveProduto(updated.find(p => p.id === selectedProductId)!);');
fs.writeFileSync('src/pages/FormacaoPreco.tsx', fp);

// MixPreco.tsx
let mp = fs.readFileSync('src/pages/MixPreco.tsx', 'utf-8');
mp = mp.replace('const { produtos, custosFixos, setProdutos } = useAppContext();', 'const { produtos, custosFixos, saveProduto } = useAppContext();');
// We need to be careful with MixPreco as it updates all products at once
// Let's use Promise.all to save all updated products in MixPreco
mp = mp.replace(/setProdutos\(updated\);/, 'updated.forEach(u => saveProduto(u));');
fs.writeFileSync('src/pages/MixPreco.tsx', mp);

