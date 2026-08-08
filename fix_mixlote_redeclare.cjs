const fs = require('fs');
let code = fs.readFileSync('src/pages/MixPrecoLote.tsx', 'utf8');

if (code.includes('const valorImposto = preco * (imposto / 100);') && code.split('const valorImposto = preco * (imposto / 100);').length > 2) {
  // Need to fix
  code = code.replace(
    `const margemContribuicao = preco - p.cmv - valorImposto - valorTaxa - valorComissao - valorMargem;`,
    `// nothing`
  );
}

