import React, { useState, useMemo, useEffect, useRef } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import {
  Search,
  X,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ChevronLeft,
  Wand2,
  Undo2,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  CreditCard,
  Receipt,
  Users,
  Tag,
} from 'lucide-react';
import { useAppContext, ProdutoItem } from '../context/AppContext';

type SortKey =
  | 'nome' | 'cmv' | 'vendas' | 'rateio' | 'imposto' | 'taxaCartao'
  | 'comissao' | 'margem' | 'preco' | 'margemContribuicao' | 'valorMargem' | 'peUnidades';

type FilterMode = 'todos' | 'sem-rateio' | 'prejuizo';

type BulkField = 'margem' | 'taxaCartao' | 'imposto' | 'comissao';

const ITEMS_PER_PAGE = 15;
const COLORS = ['#94a3b8', '#8b5cf6', '#ef4444', '#f59e0b', '#10b981'];
const CONFIRM_TIMEOUT_MS = 3500;

const BULK_FIELD_META: Record<BulkField, { label: string; productKey: keyof ProdutoItem; icon: typeof TrendingUp }> = {
  margem: { label: 'Margem Líquida', productKey: 'margem', icon: TrendingUp },
  taxaCartao: { label: 'Taxa Cartão / Maquineta', productKey: 'taxaCartao', icon: CreditCard },
  imposto: { label: 'Impostos', productKey: 'imposto', icon: Receipt },
  comissao: { label: 'Outros (Comissão e afins)', productKey: 'comissao', icon: Users },
};

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'nome', label: 'Nome (A-Z)' },
  { key: 'vendas', label: 'Vendas projetadas' },
  { key: 'rateio', label: 'Rateio do custo fixo (%)' },
  { key: 'preco', label: 'Preço de venda' },
  { key: 'margemContribuicao', label: 'Margem de contribuição' },
  { key: 'valorMargem', label: 'Lucro líquido' },
  { key: 'peUnidades', label: 'Ponto de equilíbrio' },
  { key: 'cmv', label: 'CMV' },
  { key: 'imposto', label: 'Imposto (%)' },
  { key: 'taxaCartao', label: 'Taxa cartão (%)' },
  { key: 'comissao', label: 'Outros (%)' },
  { key: 'margem', label: 'Margem (%)' },
];

export default function MixPrecoLote() {
  const { produtos, custosFixos, setProdutos } = useAppContext();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('todos');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'nome', direction: 'asc' });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const [bulkInputs, setBulkInputs] = useState<Record<BulkField, number>>({ margem: 0, taxaCartao: 0, imposto: 0, comissao: 0 });
  const [bulkSnapshots, setBulkSnapshots] = useState<Partial<Record<BulkField, Record<string, number>>>>({});
  const [isPadronizarOpen, setIsPadronizarOpen] = useState(false);

  // Confirmação inline (evita depender de window.confirm, que fica bloqueado em alguns
  // ambientes de preview em iframe — ex: templates do AI Studio — e fazia os botões
  // parecerem não funcionar).
  const [confirmingAction, setConfirmingAction] = useState<string | null>(null);
  const confirmTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (confirmTimeoutRef.current) window.clearTimeout(confirmTimeoutRef.current);
    };
  }, []);

  const requestConfirm = (actionKey: string, run: () => void) => {
    if (confirmTimeoutRef.current) window.clearTimeout(confirmTimeoutRef.current);
    if (confirmingAction === actionKey) {
      setConfirmingAction(null);
      run();
      return;
    }
    setConfirmingAction(actionKey);
    confirmTimeoutRef.current = window.setTimeout(() => setConfirmingAction(null), CONFIRM_TIMEOUT_MS);
  };

  const custoFixoTotal = custosFixos.reduce((acc, curr) => acc + curr.valor, 0);

  const handleUpdateProduto = (id: string, field: keyof ProdutoItem, value: number) => {
    const updated = produtos.map(p => (p.id === id ? { ...p, [field]: value } : p));
    setProdutos(updated);
  };

  const totalRateio = produtos.reduce((acc, p) => acc + (p.percentualRateio || 0), 0);
  const rateioPendente = 100 - totalRateio;
  const valorPendente = (rateioPendente / 100) * custoFixoTotal;

  let receitaTotal = 0;
  let margemTotal = 0;
  let vendasTotais = 0;

  const dataGraficoTotal: { name: string, value: number }[] = [
    { name: 'Custo Variável (CMV)', value: 0 },
    { name: 'Custo Fixo Unitário', value: 0 },
    { name: 'Impostos', value: 0 },
    { name: 'Taxas & Comissões', value: 0 },
    { name: 'Lucro Líquido', value: 0 },
  ];

  const processedProdutos = produtos.map(p => {
    const imposto = p.imposto || 0;
    const taxaCartao = p.taxaCartao || 0;
    const comissao = p.comissao || 0;
    const margem = p.margem || 0;
    const vendas = p.vendasProjetadas || 0;
    const rateio = p.percentualRateio || 0;

    const valorRateadoCF = (rateio / 100) * custoFixoTotal;
    const custoFixoUnitario = vendas > 0 ? (valorRateadoCF / vendas) : 0;

    const despesasVariaveisPerc = imposto + taxaCartao + comissao;
    
    let preco = 0;
    let margemReal = margem;
    
    if (p.modoPrecificacao === 'preco') {
      preco = p.precoFixo || 0;
      const custoTot = p.cmv + custoFixoUnitario;
      const descontosVariaveis = preco * (despesasVariaveisPerc / 100);
      const lucroReais = preco - custoTot - descontosVariaveis;
      margemReal = preco > 0 ? (lucroReais / preco) * 100 : 0;
    } else {
      const totalPerc = despesasVariaveisPerc + margem;
      const divisor = (100 - totalPerc) / 100;
      preco = divisor > 0 ? ((p.cmv + custoFixoUnitario) / divisor) : 0;
    }

    const valorImposto = preco * (imposto / 100);
    const valorTaxa = preco * (taxaCartao / 100);
    const valorComissao = preco * (comissao / 100);
    const valorMargem = preco * (margemReal / 100);
    const margemContribuicao = preco - p.cmv - valorImposto - valorTaxa - valorComissao;

    const isValidMargem = margemContribuicao > 0;
    const peUnidades = isValidMargem ? (valorRateadoCF / margemContribuicao) : Infinity;

    receitaTotal += preco * vendas;
    margemTotal += margemContribuicao * vendas;
    vendasTotais += vendas;

    dataGraficoTotal[0].value += p.cmv * vendas;
    dataGraficoTotal[1].value += custoFixoUnitario * vendas;
    dataGraficoTotal[2].value += valorImposto * vendas;
    dataGraficoTotal[3].value += (valorTaxa + valorComissao) * vendas;
    dataGraficoTotal[4].value += valorMargem * vendas;

    return {
      ...p,
      imposto,
      taxaCartao,
      comissao,
      margem,
      margemReal,
      rateio,
      vendas,
      preco,
      custoFixoUnitario,
      valorRateadoCF,
      valorImposto,
      valorTaxa,
      valorComissao,
      margemContribuicao,
      valorMargem,
      peUnidades,
      isValidMargem,
      semRateio: rateio === 0,
    };
  });

  const lucroMix = margemTotal - custoFixoTotal;

  const qtdSemRateio = processedProdutos.filter(p => p.semRateio).length;
  const qtdPrejuizo = processedProdutos.filter(p => !p.isValidMargem).length;

  const filteredProdutos = useMemo(() => {
    let list = processedProdutos;
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      list = list.filter(p => p.nome.toLowerCase().includes(term));
    }
    if (filterMode === 'sem-rateio') list = list.filter(p => p.semRateio);
    if (filterMode === 'prejuizo') list = list.filter(p => !p.isValidMargem);
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produtos, custosFixos, searchTerm, filterMode]);

  const sortedProdutos = useMemo(() => {
    const list = [...filteredProdutos];
    const { key, direction } = sortConfig;
    list.sort((a, b) => {
      const va = a[key as keyof typeof a];
      const vb = b[key as keyof typeof b];
      let cmp = 0;
      if (typeof va === 'string' && typeof vb === 'string') {
        cmp = va.localeCompare(vb, 'pt-BR');
      } else {
        cmp = (Number(va) || 0) - (Number(vb) || 0);
      }
      return direction === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [filteredProdutos, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(sortedProdutos.length / ITEMS_PER_PAGE));

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterMode, sortConfig, produtos.length]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);

  const paginatedProdutos = sortedProdutos.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const distribuirIgualmenteNow = () => {
    if (produtos.length === 0) return;
    const fatia = 100 / produtos.length;
    const updated = produtos.map((p, idx) => ({
      ...p,
      percentualRateio: idx === produtos.length - 1
        ? Number((100 - fatia * (produtos.length - 1)).toFixed(4))
        : Number(fatia.toFixed(4)),
    }));
    setProdutos(updated);
  };

  const handleDistribuirPendenteEntreSemRateio = () => {
    const semRateioIds = produtos.filter(p => (p.percentualRateio || 0) === 0).map(p => p.id);
    if (semRateioIds.length === 0 || rateioPendente <= 0) return;
    const fatia = rateioPendente / semRateioIds.length;
    const updated = produtos.map(p =>
      semRateioIds.includes(p.id) ? { ...p, percentualRateio: Number(fatia.toFixed(4)) } : p
    );
    setProdutos(updated);
  };

  // Aplica o mesmo valor de um campo (margem, taxa, imposto ou outros) para todos os produtos,
  // guardando os valores individuais anteriores para permitir desfazer.
  const applyBulkNow = (field: BulkField) => {
    if (produtos.length === 0) return;
    const meta = BULK_FIELD_META[field];
    const value = bulkInputs[field];

    setBulkSnapshots(prev => {
      if (prev[field]) return prev; // preserva o snapshot original enquanto a aplicação estiver ativa
      const snap: Record<string, number> = {};
      produtos.forEach(p => { snap[p.id] = Number(p[meta.productKey]) || 0; });
      return { ...prev, [field]: snap };
    });

    const updated = produtos.map(p => ({ ...p, [meta.productKey]: value }));
    setProdutos(updated);
  };

  // Desfaz a aplicação em massa, restaurando os valores individuais que cada produto tinha antes.
  const handleRemoveBulk = (field: BulkField) => {
    const meta = BULK_FIELD_META[field];
    const snap = bulkSnapshots[field];
    if (!snap) return;
    const updated = produtos.map(p => ({
      ...p,
      [meta.productKey]: snap[p.id] ?? p[meta.productKey],
    }));
    setProdutos(updated);
    setBulkSnapshots(prev => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const rateioBarPct = Math.min(100, Math.max(0, totalRateio));
  const rateioOk = Math.abs(totalRateio - 100) < 0.05;

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl sm:text-3xl font-serif text-primary">Mix de Preços em Lote</h1>
        <p className="text-muted-foreground mt-1 text-sm">Visualize e edite as variáveis de formação de preço de todos os produtos de uma só vez — mesmo com dezenas ou centenas de itens.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main Content Area */}
        <div className="flex-1 space-y-6 min-w-0">
          {/* Painel: Padronizar variáveis (aplicar/remover em massa) */}
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <button 
          onClick={() => setIsPadronizarOpen(!isPadronizarOpen)}
          className="w-full p-4 sm:p-6 border-b border-border bg-muted/30 flex items-center justify-between text-left transition-colors hover:bg-muted/50"
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Wand2 className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Padronizar variáveis</h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Defina um valor e aplique para todos os produtos de uma vez. Você pode reverter a qualquer momento.</p>
            </div>
          </div>
          <div className="text-muted-foreground">
            {isPadronizarOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
        </button>

        {isPadronizarOpen && (
          <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(Object.keys(BULK_FIELD_META) as BulkField[]).map(field => {
            const meta = BULK_FIELD_META[field];
            const Icon = meta.icon;
            const applied = !!bulkSnapshots[field];
            const actionKey = `bulk-${field}`;
            const isConfirming = confirmingAction === actionKey;

            return (
              <div key={field} className={`p-4 rounded-xl border transition-colors ${applied ? 'border-emerald-200 bg-emerald-50/40' : 'border-border bg-background hover:border-primary/30'}`}>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${applied ? 'bg-emerald-100 text-emerald-700' : 'bg-primary/10 text-primary'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-semibold text-foreground flex-1">{meta.label}</span>
                  {applied && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" /> Aplicado
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      value={bulkInputs[field]}
                      onChange={(e) => setBulkInputs(prev => ({ ...prev, [field]: Number(e.target.value) }))}
                      className="w-full px-3 py-2 pr-7 border border-border rounded-lg bg-muted/20 text-sm font-medium focus:ring-2 focus:ring-primary/50"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">%</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => requestConfirm(actionKey, () => applyBulkNow(field))}
                    disabled={produtos.length === 0}
                    className={`shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                      isConfirming
                        ? 'bg-amber-500 text-white hover:bg-amber-600'
                        : 'bg-primary text-primary-foreground hover:bg-primary/90'
                    }`}
                  >
                    {isConfirming ? 'Confirmar?' : 'Aplicar a todos'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRemoveBulk(field)}
                    disabled={!applied}
                    title="Restaurar valores individuais anteriores"
                    className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-background hover:bg-muted/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <Undo2 className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>



      {/* Barra de busca, filtro e ordenação */}
      <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar produto pelo nome..."
            className="w-full pl-9 pr-9 py-2.5 border border-border rounded-lg bg-background text-sm focus:ring-2 focus:ring-primary/50"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {filterMode !== 'todos' && (
            <button
              type="button"
              onClick={() => setFilterMode('todos')}
              className="text-xs font-medium text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Limpar filtro
            </button>
          )}
          <label className="text-xs text-muted-foreground flex items-center gap-2">
            Ordenar por:
            <select
              value={sortConfig.key}
              onChange={(e) => setSortConfig(prev => ({ ...prev, key: e.target.value as SortKey }))}
              className="px-2 py-1.5 border border-border rounded-md bg-background text-xs"
            >
              {SORT_OPTIONS.map(opt => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setSortConfig(prev => ({ ...prev, direction: prev.direction === 'asc' ? 'desc' : 'asc' }))}
            className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-border bg-background hover:bg-muted/50"
            title={sortConfig.direction === 'asc' ? 'Crescente' : 'Decrescente'}
          >
            {sortConfig.direction === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
          </button>
          <span className="text-xs text-muted-foreground">
            {sortedProdutos.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1}
            –{Math.min(currentPage * ITEMS_PER_PAGE, sortedProdutos.length)} de {sortedProdutos.length}
          </span>
        </div>
      </div>

      {/* Tabela compacta — só o essencial, para não precisar rolar de lado.
          CMV, Imposto, Taxa, Outros e Margem ficam no painel "Detalhes" de cada produto. */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden mb-8">
        <div className="overflow-x-auto max-h-[65vh] overflow-y-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/80 backdrop-blur text-muted-foreground font-medium border-b border-border sticky top-0 z-20">
              <tr>
                <th className="px-4 py-3 sticky left-0 z-30 bg-muted/95 backdrop-blur border-r border-border w-[36%] min-w-[160px]">Produto</th>
                <th className="px-3 py-3 text-center">Qtd. Vendas</th>
                <th className="px-3 py-3 text-center">Rateio CF %</th>
                <th className="px-3 py-3 text-center bg-primary text-primary-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" /> PREÇO (R$)
                  </span>
                </th>
                <th className="px-3 py-3 text-center bg-primary/5 text-primary">Lucro Liq.</th>
                <th className="px-3 py-3 text-center">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedProdutos.map((p) => {
                const isExpanded = expandedId === p.id;
                const data = [
                  { name: 'Custo Variável (CMV)', value: p.cmv },
                  { name: 'Custo Fixo Unitário', value: p.custoFixoUnitario },
                  { name: 'Impostos', value: p.valorImposto },
                  { name: 'Taxas & Comissões', value: p.valorTaxa + p.valorComissao },
                  { name: 'Lucro Líquido', value: p.valorMargem },
                ].map(item => ({ ...item, value: Number(item.value.toFixed(2)) }));

                return (
                  <React.Fragment key={p.id}>
                    <tr
                      className={`hover:bg-muted/30 transition-colors cursor-pointer ${p.semRateio ? 'bg-amber-50/40' : ''} ${!p.isValidMargem ? 'bg-red-50/40' : ''}`}
                      onClick={() => toggleExpand(p.id)}
                    >
                      <td className={`px-4 py-3 font-medium text-foreground border-r border-border sticky left-0 z-10 ${p.semRateio || !p.isValidMargem ? 'bg-inherit' : 'bg-card'}`}>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            {p.semRateio && <span title="Ainda sem % de rateio atribuído" className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />}
                            {!p.isValidMargem && <span title="Preço resulta em prejuízo" className="w-2 h-2 rounded-full bg-red-500 shrink-0" />}
                            <span className="truncate" title={p.nome}>{p.nome}</span>
                          </div>
                          <span className="text-xs text-muted-foreground mt-0.5 ml-4">CMV: R$ {p.cmv.toFixed(2)}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="number"
                          value={p.vendas}
                          onChange={(e) => handleUpdateProduto(p.id, 'vendasProjetadas', Number(e.target.value))}
                          className="w-16 mx-auto block px-2 py-1 border border-border rounded bg-muted/30 focus:ring-2 focus:ring-primary/50 text-sm text-center"
                        />
                      </td>
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="number"
                          value={p.rateio}
                          onChange={(e) => handleUpdateProduto(p.id, 'percentualRateio', Number(e.target.value))}
                          className={`w-16 mx-auto block px-2 py-1 border rounded text-sm font-bold text-center ${p.semRateio ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-amber-300 text-amber-900'} focus:ring-2 focus:ring-amber-500/50`}
                        />
                      </td>
                      <td className="px-3 py-3 text-center bg-primary/5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col items-center">
                          <input
                            type="number"
                            value={p.modoPrecificacao === 'preco' ? (p.precoFixo || 0) : Number(p.preco.toFixed(2))}
                            onChange={(e) => {
                              if (p.modoPrecificacao !== 'preco') handleUpdateProduto(p.id, 'modoPrecificacao', 'preco' as any);
                              handleUpdateProduto(p.id, 'precoFixo', Number(e.target.value));
                            }}
                            className={`w-24 mx-auto block px-2 py-1 border rounded text-sm font-bold text-center focus:ring-2 focus:ring-primary/50 ${p.modoPrecificacao === 'preco' ? 'bg-amber-100 border-amber-400 text-amber-900' : 'bg-background border-border text-foreground'}`}
                            title={p.modoPrecificacao === 'preco' ? 'Preço fixo definido pelo usuário' : 'Preço calculado. Digite para fixar um preço.'}
                          />
                          {p.modoPrecificacao === 'preco' && (
                            <span className="text-[9px] text-amber-600 font-bold mt-0.5 uppercase tracking-wider">Manual</span>
                          )}
                        </div>
                      </td>
                      <td className={`px-3 py-3 text-center bg-primary/5 font-medium ${p.valorMargem >= 0 ? 'text-primary' : 'text-red-600'}`}>
                        <div className="flex flex-col items-center justify-center">
                          <span>R$ {p.valorMargem.toFixed(2)}</span>
                          <span className="text-[10px] opacity-80">{p.margemReal.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-2">
                          {p.modoPrecificacao === 'preco' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpdateProduto(p.id, 'modoPrecificacao', 'margem' as any);
                              }}
                              className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-amber-300 bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors"
                              title="Restaurar preço sugerido pela margem"
                            >
                              <Undo2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => toggleExpand(p.id)}
                            className={`inline-flex items-center justify-center w-7 h-7 rounded-md border transition-colors ${isExpanded ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted/50'}`}
                            title="Ver e editar todos os detalhes deste produto"
                          >
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Painel expandido: mesmos elementos e campos editáveis do Mix de Preços */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={6} className="p-0 bg-muted/20">
                          <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
                            {/* Inputs */}
                            <div className="col-span-1 lg:col-span-4 space-y-4">
                              <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Custo de Aquisição (CMV)</label>
                                <input
                                  type="number"
                                  value={p.cmv}
                                  onChange={(e) => handleUpdateProduto(p.id, 'cmv', Number(e.target.value))}
                                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
                                />
                              </div>
                              <div className="flex gap-2 mt-4 mb-2">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateProduto(p.id, 'modoPrecificacao', 'margem' as any)}
                                  className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded transition-colors ${(!p.modoPrecificacao || p.modoPrecificacao === 'margem') ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}
                                >
                                  Calcular por Margem
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateProduto(p.id, 'modoPrecificacao', 'preco' as any)}
                                  className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded transition-colors ${p.modoPrecificacao === 'preco' ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}
                                >
                                  Preço Fixo
                                </button>
                              </div>

                              <div className="grid grid-cols-2 gap-4 pt-2">
                                <div>
                                  <label className="block text-xs font-medium text-muted-foreground mb-1">Impostos (%)</label>
                                  <input type="number" value={p.imposto} onChange={(e) => handleUpdateProduto(p.id, 'imposto', Number(e.target.value))} className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm" />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-muted-foreground mb-1">Taxa Cartão (%)</label>
                                  <input type="number" value={p.taxaCartao} onChange={(e) => handleUpdateProduto(p.id, 'taxaCartao', Number(e.target.value))} className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm" />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-muted-foreground mb-1">Outros (Comissão e afins) %</label>
                                  <input type="number" value={p.comissao} onChange={(e) => handleUpdateProduto(p.id, 'comissao', Number(e.target.value))} className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm" />
                                </div>
                                <div>
                                  {(!p.modoPrecificacao || p.modoPrecificacao === 'margem') ? (
                                    <>
                                      <label className="block text-xs font-medium text-muted-foreground mb-1">Margem Líquida (%)</label>
                                      <input type="number" value={p.margem} onChange={(e) => handleUpdateProduto(p.id, 'margem', Number(e.target.value))} className="w-full px-3 py-2 border border-border rounded-md bg-primary/10 font-bold text-primary text-sm focus:ring-2 focus:ring-primary/50" />
                                    </>
                                  ) : (
                                    <>
                                      <label className="block text-xs font-medium text-muted-foreground mb-1">Preço Venda (R$)</label>
                                      <input type="number" value={p.precoFixo || 0} onChange={(e) => handleUpdateProduto(p.id, 'precoFixo', Number(e.target.value))} className="w-full px-3 py-2 border border-border rounded-md bg-primary/10 font-bold text-primary text-sm focus:ring-2 focus:ring-primary/50" />
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Preço e M.C. */}
                            <div className="col-span-1 lg:col-span-4 space-y-4">
                              <div className={`border p-5 rounded-xl shadow-sm ${(!p.modoPrecificacao || p.modoPrecificacao === 'margem') ? 'bg-primary border-primary/20 text-primary-foreground' : 'bg-card border-border'}`}>
                                <p className={`text-sm font-medium mb-1 ${(!p.modoPrecificacao || p.modoPrecificacao === 'margem') ? 'opacity-80' : 'text-muted-foreground'}`}>
                                  {(!p.modoPrecificacao || p.modoPrecificacao === 'margem') ? 'Preço de Venda Ideal' : 'Preço de Venda Fixo'}
                                </p>
                                <h3 className={`text-3xl font-bold ${p.modoPrecificacao === 'preco' ? 'text-foreground' : ''}`}>R$ {p.preco.toFixed(2)}</h3>
                              </div>
                              <div className="bg-background border border-border p-4 rounded-xl shadow-sm">
                                <p className="text-sm font-medium text-muted-foreground mb-1">Margem de Contribuição</p>
                                <h3 className={`text-2xl font-semibold ${p.margemContribuicao >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>R$ {p.margemContribuicao.toFixed(2)}</h3>
                              </div>
                              <div className="bg-background border border-border p-4 rounded-xl shadow-sm">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="text-sm font-medium text-muted-foreground mb-1">Lucro Líquido</p>
                                    <h3 className={`text-2xl font-semibold ${p.valorMargem >= 0 ? 'text-primary' : 'text-red-600'}`}>R$ {p.valorMargem.toFixed(2)}</h3>
                                  </div>
                                  {p.modoPrecificacao === 'preco' && (
                                    <div className="text-right">
                                      <p className="text-sm font-medium text-muted-foreground mb-1">Margem %</p>
                                      <h3 className={`text-lg font-semibold ${p.margemReal >= 0 ? 'text-primary' : 'text-red-600'}`}>{p.margemReal.toFixed(1)}%</h3>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="bg-background border border-border p-4 rounded-xl shadow-sm">
                                <p className="text-sm font-medium text-muted-foreground mb-1">P.E. Deste Produto</p>
                                <p className="text-xl font-bold text-amber-600">
                                  {p.isValidMargem ? (p.peUnidades > 999999 ? 'Irreal' : `${Math.ceil(p.peUnidades)} unidades`) : 'Prejuízo'}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">Para pagar sua cota do custo fixo (R$ {p.valorRateadoCF.toFixed(2)})</p>
                              </div>
                            </div>

                            {/* Gráfico */}
                            <div className="col-span-1 lg:col-span-4 border border-border rounded-xl p-4 bg-background flex flex-col">
                              <p className="text-sm font-medium text-foreground mb-3 text-center">Composição do Preço</p>
                              <div className="h-40 shrink-0">
                                <ResponsiveContainer width="100%" height="100%">
                                  <PieChart>
                                    <Pie
                                      data={data}
                                      cx="50%"
                                      cy="50%"
                                      innerRadius={40}
                                      outerRadius={70}
                                      paddingAngle={2}
                                      dataKey="value"
                                    >
                                      {data.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                      ))}
                                    </Pie>
                                    <Tooltip formatter={(value: number) => `R$ ${value.toFixed(2)}`} />
                                  </PieChart>
                                </ResponsiveContainer>
                              </div>
                              <div className="mt-4 grid grid-cols-2 gap-2">
                                {data.map((item, i) => (
                                  <div key={i} className="flex items-center gap-2 text-xs">
                                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                                    <span className="truncate text-muted-foreground" title={item.name}>{item.name}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {produtos.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum produto cadastrado. Adicione produtos na aba Custos Variáveis.
                  </td>
                </tr>
              )}

              {produtos.length > 0 && sortedProdutos.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum produto encontrado para "{searchTerm}"{filterMode !== 'todos' ? ' com o filtro aplicado' : ''}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {sortedProdutos.length > ITEMS_PER_PAGE && (
          <div className="flex items-center justify-between gap-4 px-4 py-3 border-t border-border bg-muted/20">
            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-md border border-border bg-background hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Anterior
            </button>
            <span className="text-xs text-muted-foreground">Página {currentPage} de {totalPages}</span>
            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-md border border-border bg-background hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Próxima <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {produtos.length > 0 && (
        <div className="bg-card border border-border rounded-xl shadow-sm p-6 mt-6">
          <h2 className="text-xl font-bold text-foreground mb-4 text-center">Composição de Custos do Mix de Vendas</h2>
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="w-full md:w-1/2 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dataGraficoTotal}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {dataGraficoTotal.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `R$ ${value.toFixed(2)}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full md:w-1/2 space-y-3">
              {dataGraficoTotal.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                    <span className="text-muted-foreground font-medium">{item.name}</span>
                  </div>
                  <span className="font-semibold text-foreground">R$ {item.value.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
        </div>

        {/* Right Sidebar (Sticky) */}
        <div className="w-full lg:w-[300px] shrink-0">
          <div className="sticky top-6 space-y-6">
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-border bg-muted/30">
                <h2 className="text-base font-bold text-foreground">Rateio & Resultado</h2>
                <p className="text-xs text-muted-foreground mt-1">Visão geral do Mix</p>
              </div>

              <div className="p-4 space-y-5">
                <div>
                  <h3 className="text-xs font-semibold text-foreground mb-2">Rateio Global (R$ {custoFixoTotal.toFixed(2)})</h3>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs text-muted-foreground">Total Rateado</span>
                    <span className={`text-sm font-bold ${rateioOk ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {totalRateio.toFixed(1)}%
                    </span>
                  </div>

                  <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden mb-2">
                    <div
                      className={`h-full rounded-full transition-all ${rateioOk ? 'bg-emerald-500' : totalRateio > 100 ? 'bg-red-500' : 'bg-amber-500'}`}
                      style={{ width: `${rateioBarPct}%` }}
                    />
                  </div>

                  {totalRateio !== 100 && (
                    <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded text-xs font-medium text-amber-800">
                      {rateioPendente > 0
                        ? `Faltam ${rateioPendente.toFixed(1)}% (R$ ${valorPendente.toFixed(2)})`
                        : `Rateio extra de ${Math.abs(rateioPendente).toFixed(1)}%`}
                    </div>
                  )}

                  <div className="flex flex-col gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => requestConfirm('distribuir-igual', distribuirIgualmenteNow)}
                      disabled={produtos.length === 0}
                      className={`inline-flex justify-center items-center gap-1.5 text-xs font-medium px-2 py-1.5 rounded border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                        confirmingAction === 'distribuir-igual'
                          ? 'border-amber-400 bg-amber-500 text-white'
                          : 'border-border bg-background hover:bg-muted/50'
                      }`}
                      title="Divide 100% igualmente entre todos os produtos"
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      {confirmingAction === 'distribuir-igual' ? 'Confirmar?' : 'Distribuir igual'}
                    </button>
                    <button
                      type="button"
                      onClick={handleDistribuirPendenteEntreSemRateio}
                      disabled={qtdSemRateio === 0 || rateioPendente <= 0}
                      className="inline-flex justify-center items-center gap-1.5 text-xs font-medium px-2 py-1.5 rounded border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      title="Divide apenas o % pendente entre os produtos que ainda estão com 0%"
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      Pendentes ({qtdSemRateio})
                    </button>
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-border">
                  <h3 className="text-xs font-semibold text-foreground">Projeção do Mix</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded border border-border bg-background">
                      <p className="text-[10px] text-muted-foreground mb-0.5">Vendas Totais</p>
                      <p className="text-sm font-bold text-foreground">{vendasTotais}</p>
                    </div>
                    <div className="p-2 rounded border border-border bg-background">
                      <p className="text-[10px] text-muted-foreground mb-0.5">Receita</p>
                      <p className="text-sm font-bold text-foreground">R$ {receitaTotal.toFixed(0)}</p>
                    </div>
                    <div className="p-2 rounded border border-border bg-background">
                      <p className="text-[10px] text-muted-foreground mb-0.5">M.C. Total</p>
                      <p className="text-sm font-bold text-emerald-600">R$ {margemTotal.toFixed(0)}</p>
                    </div>
                    <div className={`p-2 rounded border ${lucroMix >= 0 ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
                      <p className={`text-[10px] font-medium mb-0.5 ${lucroMix >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>Resultado</p>
                      <p className={`text-sm font-bold ${lucroMix >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>R$ {lucroMix.toFixed(0)}</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 pt-2">
                    {qtdSemRateio > 0 && (
                      <button
                        type="button"
                        onClick={() => setFilterMode(filterMode === 'sem-rateio' ? 'todos' : 'sem-rateio')}
                        className={`inline-flex items-center justify-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded border transition-colors ${filterMode === 'sem-rateio' ? 'bg-amber-500 text-white border-amber-500' : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'}`}
                      >
                        <AlertTriangle className="w-3 h-3" />
                        {qtdSemRateio} sem rateio
                      </button>
                    )}
                    {qtdPrejuizo > 0 && (
                      <button
                        type="button"
                        onClick={() => setFilterMode(filterMode === 'prejuizo' ? 'todos' : 'prejuizo')}
                        className={`inline-flex items-center justify-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded border transition-colors ${filterMode === 'prejuizo' ? 'bg-red-500 text-white border-red-500' : 'bg-red-50 border-red-200 text-red-800 hover:bg-red-100'}`}
                      >
                        <AlertTriangle className="w-3 h-3" />
                        {qtdPrejuizo} c/ prejuízo
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}