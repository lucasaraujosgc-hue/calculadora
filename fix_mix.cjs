const fs = require('fs');
let code = fs.readFileSync('src/pages/MixPreco.tsx', 'utf-8');
const oldCode = `  const { produtos, custosFixos, saveProduto } = useAppContext();
  const [useGlobalImposto, setUseGlobalImposto] = useState(false);
  const [globalImposto, setGlobalImposto] = useState(0);

  const custoFixoTotal = custosFixos.reduce((acc, curr) => acc + curr.valor, 0);

  const handleUpdateProduto = (id: string, field: keyof ProdutoItem, value: number) => {
    const updated = produtos.map(p => {
      if (p.id === id) {
        return { ...p, [field]: value };
      }
      return p;
    });
    updated.forEach(u => saveProduto(u));
  };`;

const newCode = `  const { produtos, custosFixos, saveProduto, setProdutos } = useAppContext();
  const [useGlobalImposto, setUseGlobalImposto] = useState(false);
  const [globalImposto, setGlobalImposto] = useState(0);

  const custoFixoTotal = custosFixos.reduce((acc, curr) => acc + curr.valor, 0);

  const handleUpdateProduto = (id: string, field: keyof ProdutoItem, value: number | string) => {
    let updatedProduto;
    const updated = produtos.map(p => {
      if (p.id === id) {
        updatedProduto = { ...p, [field]: value };
        return updatedProduto;
      }
      return p;
    });
    setProdutos(updated);
    if (updatedProduto) {
      saveProduto(updatedProduto).catch(err => console.error(err));
    }
  };`;

code = code.replace(oldCode, newCode);
fs.writeFileSync('src/pages/MixPreco.tsx', code);
