const fs = require('fs');
let code = fs.readFileSync('src/components/Layout.tsx', 'utf8');

const oldMenu = `    { name: 'Formação de Preço', path: '/formacao-preco', icon: Calculator, highlight: 'bg-red-500/10 text-red-600 border-red-500/20' },
    // { name: 'Mix de Preços', path: '/mix-preco', icon: Box, highlight: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
    { name: 'Preços em Lote', path: '/mix-preco-lote', icon: Layers, highlight: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
    { name: 'Planos e Upgrades', path: '/planos', icon: Star, highlight: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
    { name: 'Minha Conta', path: '/configuracoes', icon: Settings },
  ];`;

const newMenu = `    { name: 'Formação de Preço', path: '/formacao-preco', icon: Calculator, highlight: 'bg-red-500/10 text-red-600 border-red-500/20' },
    // { name: 'Mix de Preços', path: '/mix-preco', icon: Box, highlight: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
    { name: 'Preços em Lote', path: '/mix-preco-lote', icon: Layers, highlight: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
    ...(user ? [{ name: 'Planos e Upgrades', path: '/planos', icon: Star, highlight: 'bg-amber-500/10 text-amber-600 border-amber-500/20' }] : []),
    { name: 'Minha Conta', path: '/configuracoes', icon: Settings },
  ];`;

code = code.replace(oldMenu, newMenu);
fs.writeFileSync('src/components/Layout.tsx', code);
