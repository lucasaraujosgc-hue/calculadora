import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  BrainCircuit,
  Undo2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  CreditCard,
  Receipt,
  Users,
  Tag,
  BarChart3,
} from 'lucide-react';
import { useAppContext, ProdutoItem } from '../context/AppContext';
import { calcularMix, calculateSellingPrice } from '../domain/pricing';
import { formatCurrency } from '../utils/format';
import { exportToExcel } from '../utils/export';
import {
  PainelReformaPreco,
  SeloPrecoReforma,
  useMotorReforma,
  useReformaPrecoConfig,
} from '../components/ReformaPreco';
import { FileText } from 'lucide-react';
import CostCompositionChart from '../components/CostCompositionChart';
import DespesasVariaveisManager from '../components/DespesasVariaveisManager';
import EstrategiasManager, { SeletorEstrategia, SeloEstrategia } from '../components/Estrategias';
import CurvaABC, { SeloClasseABC } from '../components/CurvaABC';
import { classificarABC, type CriterioABC, type MapeamentoABC } from '../domain/abc';
import type { ItemEquilibrio } from '../domain/elasticidade/equilibrio';

type SortKey =
  | 'nome' | 'cmv' | 'vendas' | 'rateio' | 'imposto' | 'taxaCartao'
  | 'comissao' | 'margem' | 'preco' | 'margemContribuicao' | 'valorMargem' | 'peUnidades'
  | 'classeABC';

type FilterMode = 'todos' | 'sem-rateio' | 'prejuizo' | 'rateio-ocioso' | 'classe-a' | 'classe-b' | 'classe-c' | 'abaixo-piso';

/**
 * Campo aplicável em massa. Os quatro primeiros são fixos; além deles entram as
 * despesas variáveis que o usuário criou, com a chave `despesa:<id>`.
 */
type BulkField = string;

interface BulkFieldDef {
  key: BulkField;
  label: string;
  icon: typeof TrendingUp;
  ler: (p: ProdutoItem) => number;
  aplicar: (p: ProdutoItem, valor: number) => ProdutoItem;
}

const ITEMS_PER_PAGE = 15;
const CONFIRM_TIMEOUT_MS = 3500;

/** Campo simples: grava direto numa propriedade numérica do produto. */
function campoSimples(
  key: keyof ProdutoItem,
  label: string,
  icon: typeof TrendingUp
): BulkFieldDef {
  return {
    key,
    label,
    icon,
    ler: p => Number(p[key]) || 0,
    aplicar: (p, valor) => ({ ...p, [key]: valor }),
  };
}

/** Campo de despesa personalizada: grava dentro do mapa `despesasVariaveis`. */
function campoDespesa(id: string, nome: string): BulkFieldDef {
  return {
    key: `despesa:${id}`,
    label: nome,
    icon: Tag,
    ler: p => Number(p.despesasVariaveis?.[id]) || 0,
    aplicar: (p, valor) => ({
      ...p,
      despesasVariaveis: { ...(p.despesasVariaveis || {}), [id]: valor },
    }),
  };
}

// A margem não está mais aqui de propósito. Aplicar o mesmo percentual ao
// catálogo inteiro dá a todo produto o mesmo multiplicador sobre o custo, o que
// deixa a loja cara justo nos itens que o cliente compara e barata nos que
// ninguém confere. Quem quiser margem única continua conseguindo: é só aplicar
// uma única estratégia a todos, no painel de estratégias logo acima.
const BULK_FIELDS_FIXOS: BulkFieldDef[] = [
  campoSimples('taxaCartao', 'Taxa Cartão / Maquineta', CreditCard),
  campoSimples('imposto', 'Impostos', Receipt),
  campoSimples('comissao', 'Comissão', Users),
];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'nome', label: 'Nome (A-Z)' },
  { key: 'vendas', label: 'Vendas projetadas' },
  { key: 'rateio', label: 'Rateio do custo fixo (%)' },
  { key: 'preco', label: 'Preço de venda' },
  { key: 'margemContribuicao', label: 'Margem de contribuição' },
  { key: 'valorMargem', label: 'Lucro líquido' },
  { key: 'peUnidades', label: 'Ponto de equilíbrio' },
  { key: 'classeABC', label: 'Classe ABC' },
  { key: 'cmv', label: 'CMV' },
  { key: 'imposto', label: 'Imposto (%)' },
  { key: 'taxaCartao', label: 'Taxa cartão (%)' },
  { key: 'comissao', label: 'Outros (%)' },
  { key: 'margem', label: 'Margem (%)' },
];

const PriceInput = ({
  p,
  onUpdate
}: {
  p: any,
  onUpdate: (id: string, updates: Partial<ProdutoItem>) => void
}) => {
  const [val, setVal] = useState<string>(
    p.modoPrecificacao === 'preco' ? String(p.precoFixo || '') : p.preco.toFixed(2)
  );

  useEffect(() => {
    if (p.modoPrecificacao !== 'preco') {
      setVal(p.preco.toFixed(2));
    } else {
      // Quando for modo 'preco', temos que sincronizar caso o precoFixo mude por fora (ex: botões laterais)
      setVal(String(p.precoFixo || ''));
    }
  }, [p.modoPrecificacao, p.preco, p.precoFixo]);

  return (
    <input
      type="number"
      step="0.01"
      value={val}
      onChange={(e) => {
        setVal(e.target.value);
        onUpdate(p.id, {
          modoPrecificacao: 'preco',
          precoFixo: Number(e.target.value)
        });
      }}
      className={`w-20 mx-auto block px-1.5 py-1 border rounded text-sm font-bold text-center focus:ring-2 focus:ring-primary/50 ${p.modoPrecificacao === 'preco' ? 'bg-amber-100 border-amber-400 text-amber-900' : 'bg-background border-border text-foreground'}`}
      title={p.modoPrecificacao === 'preco' ? 'Preço fixo definido pelo usuário' : 'Preço calculado. Digite para fixar um preço.'}
    />
  );
};

export default function MixPrecoLote() {
  const { produtos, custosFixos, setProdutos, syncProdutos, despesasVariaveis, estrategias } = useAppContext();
  const validProdutos = useMemo(() => produtos.filter(p => p.cmv > 0), [produtos]);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('todos');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'nome', direction: 'asc' });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const [bulkInputs, setBulkInputs] = useState<Record<BulkField, number>>({});
  const [bulkSnapshots, setBulkSnapshots] = useState<Partial<Record<BulkField, Record<string, number>>>>({});
  const [isPadronizarOpen, setIsPadronizarOpen] = useState(false);
  const [isAbcOpen, setIsAbcOpen] = useState(false);
  const [criterioABC, setCriterioABC] = useState<CriterioABC>('faturamento');

  // Painel de pesos da distribuição inteligente (aberto ao clicar em "Distribuir inteligente")
  const [minRateioValor, setMinRateioValor] = useState<number | ''>('');
  const [showPesoConfig, setShowPesoConfig] = useState(false);
  const [pesos, setPesos] = useState({ vendas: 30, receita: 30, lucro: 40 });
  const somaPesos = pesos.vendas + pesos.receita + pesos.lucro;

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

  // Os quatro campos fixos mais uma coluna por despesa variável cadastrada.
  const bulkFields: BulkFieldDef[] = useMemo(
    () => [...BULK_FIELDS_FIXOS, ...despesasVariaveis.map(d => campoDespesa(d.id, d.nome))],
    [despesasVariaveis]
  );

  const custoFixoTotal = custosFixos.reduce((acc, curr) => acc + curr.valor, 0);

  // Projeção do preço na Reforma Tributária (compartilhada com a Formação de Preço)
  const { config: reformaConfig, setConfig: setReformaConfig } = useReformaPrecoConfig();
  const motorReforma = useMotorReforma(reformaConfig);

  const handleUpdateProduto = (id: string, updates: Partial<ProdutoItem>) => {
    const updated = produtos.map(p => (p.id === id ? { ...p, ...updates } : p));
    setProdutos(updated); syncProdutos(updated).catch(err => console.error(err));
  };

  const totalRateio = validProdutos.reduce((acc, p) => acc + (p.percentualRateio || 0), 0);
  const rateioPendente = 100 - totalRateio;
  const valorPendente = (rateioPendente / 100) * custoFixoTotal;

  // Todo o cálculo do mix vem de src/domain/pricing — a mesma função que o
  // Dashboard usa. Antes, cada tela tinha a sua cópia da fórmula, e foi assim
  // que o export do Excel passou a mostrar números diferentes da tela.
  const mix = calcularMix(validProdutos, custoFixoTotal, despesasVariaveis, estrategias);

  // Curva ABC sobre o mix já calculado — o preço em vigor de cada produto, não
  // uma segunda conta paralela.
  const abc = useMemo(() => classificarABC(mix.produtos.map(p => {
    const vendas = p.vendasProjetadas || 0;
    const valor = criterioABC === 'quantidade' ? vendas
      : criterioABC === 'margem' ? p.margemContribuicao * vendas
      : p.preco * vendas;
    return { id: p.id, valor };
  })), [mix, criterioABC]);

  /**
   * Roda o mix como ficaria se o mapeamento fosse aplicado, sem aplicar.
   *
   * Existe porque trocar a faixa das classes mexe no preço de dezenas de
   * produtos de uma vez: sem ver o resultado antes, o usuário só descobre que
   * cortou o lucro pela metade depois de ter cortado.
   */
  const simularPorClasse = (mapa: MapeamentoABC) => {
    const hipotetico = validProdutos.map(p => {
      const classe = abc.porId[p.id]?.classe;
      const destino = classe ? mapa[classe] : null;
      return destino ? { ...p, estrategiaId: destino } : p;
    });
    return calcularMix(hipotetico, custoFixoTotal, despesasVariaveis, estrategias);
  };

  /**
   * Itens para a conta de equilíbrio: preço de hoje contra preço proposto.
   *
   * Não depende de histórico nenhum — sai de preço, CMV e deduções, que o
   * sistema tem de todo produto. É o que permite dar um veredito sobre o corte
   * mesmo para quem nunca importou uma nota.
   */
  const itensParaEquilibrio = (mapa: MapeamentoABC): ItemEquilibrio[] => {
    const depois = simularPorClasse(mapa);
    return mix.produtos.map(atual => {
      const novo = depois.produtos.find(x => x.id === atual.id);
      return {
        precoAtual: atual.preco,
        precoNovo: novo ? novo.preco : atual.preco,
        cmv: atual.cmv,
        deducoesPercent: atual.deducoesPercent,
        quantidade: atual.vendasProjetadas || 0,
      };
    });
  };

  /** Põe cada produto na faixa escolhida para a classe dele. */
  const aplicarEstrategiasPorClasse = (mapa: MapeamentoABC) => {
    const updated = produtos.map(p => {
      const classe = abc.porId[p.id]?.classe;
      const destino = classe ? mapa[classe] : null;
      return destino ? { ...p, estrategiaId: destino } : p;
    });
    setProdutos(updated); syncProdutos(updated).catch(err => console.error(err));
  };


  const receitaTotal = mix.receitaTotal;
  const margemTotal = mix.margemContribuicaoTotal;
  const vendasTotais = mix.vendasTotais;
  const lucroMix = mix.lucroLiquidoTotal;

  const dataGraficoTotal: { name: string, value: number }[] = [
    { name: 'Custo Variável (CMV)', value: 0 },
    { name: 'Custo Fixo Unitário', value: 0 },
    { name: 'Impostos', value: 0 },
    { name: 'Taxas & Despesas', value: 0 },
    { name: 'Lucro Líquido', value: 0 },
  ];

  let receitaTotalReforma = 0;

  const processedProdutos = mix.produtos.map(p => {
    const vendas = p.vendasProjetadas || 0;

    const projecaoReforma = motorReforma.projetar({
      cmv: p.cmv,
      custoFixoUnitario: p.custoFixoUnitario,
      impostoPercent: p.impostoPercent,
      despesasPercent: p.despesasPercent,
      margemPercent: p.margemReal,
      precoAtual: p.preco,
    });

    receitaTotalReforma += (motorReforma.precoMuda ? projecaoReforma.precoMantendoMargem : p.preco) * vendas;

    dataGraficoTotal[0].value += p.cmv * vendas;
    dataGraficoTotal[1].value += p.custoFixoUnitario * vendas;
    dataGraficoTotal[2].value += p.valorImposto * vendas;
    dataGraficoTotal[3].value += p.valorDespesas * vendas;
    dataGraficoTotal[4].value += p.valorMargem * vendas;

    return {
      ...p,
      imposto: p.imposto || 0,
      taxaCartao: p.taxaCartao || 0,
      comissao: p.comissao || 0,
      margem: p.margem || 0,
      rateio: p.percentualRateio || 0,
      vendas,
      semRateio: (p.percentualRateio || 0) === 0,
      projecaoReforma,
      classeABCLetra: abc.porId[p.id]?.classe,
      // A ordenação usa número porque A tem que vir antes de B.
      classeABC: abc.porId[p.id] ? { A: 1, B: 2, C: 3 }[abc.porId[p.id].classe] : 4,
    };
  });

  const variacaoReceitaReforma = receitaTotal > 0 ? ((receitaTotalReforma - receitaTotal) / receitaTotal) * 100 : 0;

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
    if (filterMode === 'rateio-ocioso') list = list.filter(p => p.rateioOcioso);
    if (filterMode === 'classe-a') list = list.filter(p => p.classeABCLetra === 'A');
    if (filterMode === 'classe-b') list = list.filter(p => p.classeABCLetra === 'B');
    if (filterMode === 'classe-c') list = list.filter(p => p.classeABCLetra === 'C');
    if (filterMode === 'abaixo-piso') list = list.filter(p => p.abaixoDoPiso);
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validProdutos, custosFixos, searchTerm, filterMode, abc]);

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
  }, [searchTerm, filterMode, sortConfig, validProdutos.length]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);

  const paginatedProdutos = sortedProdutos.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Só entra no rateio quem atinge o CMV mínimo E tem vendas projetadas.
  //
  // A exigência das vendas não é um detalhe: o custo fixo unitário é a cota
  // dividida pelas unidades vendidas, então uma cota dada a um produto sem
  // vendas não vira preço em lugar nenhum — ela some, e os 100% do rateio
  // passam a cobrir menos que 100% do custo fixo.
  const elegiveisParaRateio = () => {
    const limite = Number(minRateioValor) || 0;
    return validProdutos.filter(p => p.cmv >= limite && (p.vendasProjetadas || 0) > 0);
  };

  const avisarSemElegiveis = () => {
    const limite = Number(minRateioValor) || 0;
    const barradosPorVendas = validProdutos.filter(p => p.cmv >= limite && (p.vendasProjetadas || 0) <= 0).length;
    alert(
      barradosPorVendas > 0
        ? "Nenhum produto pode receber rateio: os que atingem o custo mínimo estão sem vendas projetadas, e sem vendas a cota do custo fixo não entra no preço."
        : "Nenhum produto atinge o valor mínimo para rateio."
    );
  };

  const distribuirIgualmenteNow = () => {
    const elegiveis = elegiveisParaRateio();

    if (elegiveis.length === 0) {
      avisarSemElegiveis();
      return;
    }

    const fatia = 100 / elegiveis.length;
    const ultimoValidoId = elegiveis[elegiveis.length - 1]?.id;
    let somaFatias = 0;

    const updated = produtos.map(p => {
      // Se não é válido ou não atingiu o mínimo, zera o rateio
      if (!elegiveis.find(v => v.id === p.id)) {
        // Só zerar os que eram válidos mas não elegíveis, ou todos inválidos?
        // Vamos zerar todos que não são elegíveis, já que 100% foi dividido entre os elegíveis.
        return { ...p, percentualRateio: 0 };
      }

      let percentual: number;
      if (p.id === ultimoValidoId) {
        percentual = Number((100 - somaFatias).toFixed(4));
      } else {
        percentual = Number(fatia.toFixed(4));
        somaFatias += percentual;
      }
      return { ...p, percentualRateio: percentual };
    });
    setProdutos(updated); syncProdutos(updated).catch(err => console.error(err));
  };

  // Distribuição inteligente 100% client-side: calcula, para cada produto, um índice
  // ponderado a partir de 3 dimensões (participação nas vendas, na receita e na
  // capacidade de gerar lucro), com pesos ajustáveis pelo usuário no painel abaixo do botão.
  //
  // Importante: receita e margem de contribuição usadas no índice são recalculadas com um preço
  // "base", ignorando o custo fixo unitário ATUAL (custoFixoUnitario = 0), e usadas apenas aqui —
  // não substituem o preço/margem exibidos no restante da tela. Isso evita um ciclo vicioso:
  // sem isso, o rateio já aplicado influencia o preço (via custo fixo unitário), o preço influencia
  // receita/margem, e receita/margem influenciam o novo rateio — fazendo produtos que já têm mais
  // rateio hoje parecerem "gerar mais receita/lucro" só por causa disso, e tenderem a receber ainda
  // mais rateio a cada nova aplicação (efeito bola de neve). Produtos com preço fixo definido pelo
  // usuário (modoPrecificacao === 'preco') já são naturalmente imunes a esse ciclo.
  //
  // Também respeita o mesmo "valor mínimo de CMV para ratear" usado em "Distribuir igual":
  // produtos abaixo do limite ficam de fora do cálculo dos índices e recebem 0% de rateio;
  // os 100% são divididos apenas entre os produtos elegíveis.
  const distribuirInteligentemente = (pesosAtuais: { vendas: number; receita: number; lucro: number }) => {
    if (validProdutos.length === 0) return;

    const idsElegiveis = new Set(elegiveisParaRateio().map(p => p.id));
    const elegiveis = processedProdutos.filter(p => idsElegiveis.has(p.id));

    if (elegiveis.length === 0) {
      avisarSemElegiveis();
      return;
    }

    const somaPesosInformados = pesosAtuais.vendas + pesosAtuais.receita + pesosAtuais.lucro;
    if (somaPesosInformados <= 0) {
      alert("Defina ao menos um peso maior que zero para calcular a distribuição.");
      return;
    }

    // Os pesos não precisam somar exatamente 100 — são normalizados aqui.
    const wVendas = pesosAtuais.vendas / somaPesosInformados;
    const wReceita = pesosAtuais.receita / somaPesosInformados;
    const wLucro = pesosAtuais.lucro / somaPesosInformados;

    const n = elegiveis.length;

    const baseById: Record<string, { precoBase: number; margemContribuicaoBase: number }> = {};
    elegiveis.forEach(p => {
      const despesasVariaveisPerc = p.imposto + p.taxaCartao + p.comissao;
      // Preço fixo definido pelo usuário já independe do rateio; caso contrário, recalcula
      // o preço "sem" custo fixo unitário só para medir o produto isoladamente.
      const precoBase = p.modoPrecificacao === 'preco'
        ? p.preco
        : calculateSellingPrice(p.cmv, 0, p.imposto / 100, p.taxaCartao / 100, p.comissao / 100, p.margem / 100);
      const margemContribuicaoBase = precoBase - p.cmv - (precoBase * despesasVariaveisPerc / 100);
      baseById[p.id] = { precoBase, margemContribuicaoBase };
    });

    let totalVendas = 0;
    let totalReceita = 0;
    let totalLucroPositivo = 0;

    elegiveis.forEach(p => {
      const { precoBase, margemContribuicaoBase } = baseById[p.id];
      totalVendas += p.vendas;
      totalReceita += precoBase * p.vendas;
      // Capacidade de gerar lucro = margem de contribuição total do produto (preço base - custo variável) × vendas.
      // Produtos com resultado negativo entram com 0 aqui para não "puxar" o índice para baixo.
      totalLucroPositivo += Math.max(0, margemContribuicaoBase * p.vendas);
    });

    if (totalVendas === 0 && totalReceita === 0 && totalLucroPositivo === 0) {
      alert("Não há dados suficientes (vendas, receita ou capacidade de gerar lucro) para calcular a distribuição inteligente. Caindo de volta para a divisão igual.");
      distribuirIgualmenteNow();
      return;
    }

    const indicesPorId: Record<string, number> = {};
    let somaIndices = 0;

    elegiveis.forEach(p => {
      const { precoBase, margemContribuicaoBase } = baseById[p.id];
      const shareVendas = totalVendas > 0 ? p.vendas / totalVendas : 1 / n;
      const shareReceita = totalReceita > 0 ? (precoBase * p.vendas) / totalReceita : 1 / n;
      const lucroPositivo = Math.max(0, margemContribuicaoBase * p.vendas);
      const shareLucro = totalLucroPositivo > 0 ? lucroPositivo / totalLucroPositivo : 1 / n;

      const indice = shareVendas * wVendas + shareReceita * wReceita + shareLucro * wLucro;
      indicesPorId[p.id] = indice;
      somaIndices += indice;
    });

    let somaFatias = 0;
    const ultimoProdutoId = elegiveis[elegiveis.length - 1]?.id;

    const updated = produtos.map(p => {
      if (!validProdutos.find(v => v.id === p.id)) {
        return p;
      }

      // Produto válido mas fora dos elegíveis (abaixo do CMV mínimo definido) -> zera o rateio,
      // igual ao comportamento de "Distribuir igual".
      if (!elegiveis.find(v => v.id === p.id)) {
        return { ...p, percentualRateio: 0 };
      }

      let percentual = 0;
      if (p.id === ultimoProdutoId) {
        // Último produto absorve o resto, evitando erro de arredondamento (soma diferente de 100%).
        percentual = Number((100 - somaFatias).toFixed(4));
      } else {
        const indice = indicesPorId[p.id] || 0;
        percentual = somaIndices > 0 ? Number(((indice / somaIndices) * 100).toFixed(4)) : 0;
        somaFatias += percentual;
      }

      return {
        ...p,
        percentualRateio: percentual
      };
    });

    setProdutos(updated);
    syncProdutos(updated).catch(err => console.error(err));
  };

  const handleDistribuirPendenteEntreSemRateio = () => {
    // Mesma regra dos outros botões: sem vendas projetadas, a cota não vira preço.
    const semRateioIds = produtos
      .filter(p => (p.percentualRateio || 0) === 0 && (p.vendasProjetadas || 0) > 0)
      .map(p => p.id);
    if (semRateioIds.length === 0 || rateioPendente <= 0) return;
    const fatia = rateioPendente / semRateioIds.length;
    const updated = produtos.map(p =>
      semRateioIds.includes(p.id) ? { ...p, percentualRateio: Number(fatia.toFixed(4)) } : p
    );
    setProdutos(updated); syncProdutos(updated).catch(err => console.error(err));
  };

  // Aplica o mesmo valor de um campo (margem, taxa, imposto ou outros) para todos os produtos,
  // guardando os valores individuais anteriores para permitir desfazer.
  /**
   * Põe todos os produtos na mesma faixa.
   *
   * É o substituto honesto do antigo "aplicar 25% de margem a todos": o
   * resultado imediato é o mesmo (todo mundo com a mesma margem alvo), mas
   * agora isso é um ponto de partida explícito, e mover um produto para outra
   * faixa depois é um clique — não uma edição solta que ninguém consegue
   * auditar seis meses depois.
   */
  const aplicarEstrategiaATodos = (estrategiaId: string) => {
    if (validProdutos.length === 0) return;
    const updated = produtos.map(p => ({ ...p, estrategiaId }));
    setProdutos(updated); syncProdutos(updated).catch(err => console.error(err));
  };

  const applyBulkNow = (field: BulkField) => {
    if (validProdutos.length === 0) return;
    const def = bulkFields.find(f => f.key === field);
    if (!def) return;
    const value = bulkInputs[field] || 0;

    setBulkSnapshots(prev => {
      if (prev[field]) return prev; // preserva o snapshot original enquanto a aplicação estiver ativa
      const snap: Record<string, number> = {};
      produtos.forEach(p => { snap[p.id] = def.ler(p); });
      return { ...prev, [field]: snap };
    });

    const updated = produtos.map(p => def.aplicar(p, value));
    setProdutos(updated); syncProdutos(updated).catch(err => console.error(err));
  };

  // Desfaz a aplicação em massa, restaurando os valores individuais que cada produto tinha antes.
  const handleRemoveBulk = (field: BulkField) => {
    const def = bulkFields.find(f => f.key === field);
    const snap = bulkSnapshots[field];
    if (!def || !snap) return;
    const updated = produtos.map(p => def.aplicar(p, snap[p.id] ?? def.ler(p)));
    setProdutos(updated); syncProdutos(updated).catch(err => console.error(err));
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
      <div>
        <h1 className="text-2xl sm:text-3xl font-serif text-primary">Mix de Preços em Lote</h1>
        <p className="text-muted-foreground mt-1 text-sm">Visualize e edite as variáveis de formação de preço de todos os produtos de uma só vez — mesmo com dezenas ou centenas de itens.</p>
      </div>
      <div className="flex gap-2">
         <button onClick={() => {
            // Os mesmos totais que a tela mostra, vindos do mesmo cálculo —
            // não há uma segunda fórmula aqui para divergir da primeira.
            const mcUnitMap: Record<string, number> = {};
            mix.produtos.forEach(p => { mcUnitMap[p.id] = p.margemContribuicao; });

            exportToExcel(
               false,
               produtos,
               mix.receitaTotal,
               custoFixoTotal,
               mix.custosVariaveisTotais,
               mix.impostoValorTotal + mix.despesasValorTotal,
               mix.margemContribuicaoTotal,
               mix.lucroLiquidoTotal,
               mix.pontoEquilibrioFaturamento,
               mcUnitMap
            );
         }} className="px-3 py-1.5 bg-background border border-border rounded-md text-sm font-medium hover:bg-muted transition-colors flex items-center gap-2">
           <FileText className="w-4 h-4"/> Excel
         </button>
         <button onClick={() => window.print()} className="px-3 py-1.5 bg-background border border-border rounded-md text-sm font-medium hover:bg-muted transition-colors flex items-center gap-2">
           <FileText className="w-4 h-4"/> PDF
         </button>
      </div>
    </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main Content Area */}
        <div className="flex-1 space-y-6 min-w-0">
          {/* Painel: Padronizar variáveis (aplicar/remover em massa) */}
          <div className="bg-card border-2 border-primary/40 rounded-xl shadow-md overflow-hidden relative">
          <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-primary/40 via-primary to-primary/40 opacity-70"></div>
        <button
          onClick={() => setIsPadronizarOpen(!isPadronizarOpen)}
          className="w-full p-4 sm:p-6 border-b border-border bg-primary/5 flex items-center justify-between text-left transition-colors hover:bg-primary/10"
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-sm animate-pulse-slow">
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                Padronizar variáveis
                <span className="text-[10px] uppercase tracking-wider font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">Passo 1</span>
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 font-medium text-foreground/80">
                Configure aqui primeiro para que o sistema consiga calcular e mostrar os preços sugeridos corretamente.
              </p>
            </div>
          </div>
          <div className="text-primary p-2 bg-background rounded-full shadow-sm border border-border">
            {isPadronizarOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
        </button>

        {isPadronizarOpen && (
          <div className="p-4 sm:p-6 space-y-5">
          <EstrategiasManager compacto />

          <div className="pt-4 border-t border-border">
            <p className="text-xs font-semibold text-foreground mb-1">Aplicar uma estratégia a todos os produtos</p>
            <p className="text-[11px] text-muted-foreground mb-2">
              Um ponto de partida para depois ajustar produto a produto — quem é atração e quem é margem.
            </p>
            <div className="flex flex-wrap gap-2">
              {estrategias.map(e => {
                const actionKey = `estrategia-${e.id}`;
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => requestConfirm(actionKey, () => aplicarEstrategiaATodos(e.id))}
                    disabled={validProdutos.length === 0}
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                      confirmingAction === actionKey
                        ? 'bg-amber-500 text-white border-amber-500'
                        : 'bg-background border-border hover:border-primary/40 hover:bg-muted/40'
                    }`}
                  >
                    {confirmingAction === actionKey ? 'Confirmar?' : <>{e.nome} · {e.margem}%</>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border">
            {bulkFields.map(meta => {
            const field = meta.key;
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
                      value={bulkInputs[field] ?? 0}
                      onChange={(e) => setBulkInputs(prev => ({ ...prev, [field]: Number(e.target.value) }))}
                      className="w-full px-3 py-2 pr-7 border border-border rounded-lg bg-muted/20 text-sm font-medium focus:ring-2 focus:ring-primary/50"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">%</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => requestConfirm(actionKey, () => applyBulkNow(field))}
                    disabled={validProdutos.length === 0}
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

          <div className="pt-4 border-t border-border">
            <DespesasVariaveisManager compacto />
          </div>
        </div>
        )}
      </div>



      {/* Curva ABC: qual produto merece qual estratégia. Vem depois de
          padronizar as variáveis porque depende dos preços já calculados. */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <button
          onClick={() => setIsAbcOpen(!isAbcOpen)}
          className="w-full p-4 sm:p-6 flex items-center justify-between text-left transition-colors hover:bg-muted/30"
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-800 flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                Curva ABC
                <span className="text-[10px] uppercase tracking-wider font-bold bg-violet-100 text-violet-900 px-2 py-0.5 rounded-full">Passo 2</span>
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Descubra quais produtos sustentam o resultado e aplique a estratégia certa a cada grupo.
              </p>
            </div>
          </div>
          <div className="text-primary p-2 bg-background rounded-full shadow-sm border border-border">
            {isAbcOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
        </button>

        {isAbcOpen && (
          <div className="p-4 sm:p-6 border-t border-border">
            <CurvaABC
              abc={abc}
              criterio={criterioABC}
              setCriterio={setCriterioABC}
              onAplicar={aplicarEstrategiasPorClasse}
              onSimular={simularPorClasse}
              onItensEquilibrio={itensParaEquilibrio}
              receitaAtual={receitaTotal}
              lucroAtual={lucroMix}
            />
          </div>
        )}
      </div>

      <PainelReformaPreco config={reformaConfig} setConfig={setReformaConfig} motor={motorReforma} />

      {reformaConfig.ativo && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-card border border-border p-4 rounded-xl shadow-sm">
            <p className="text-xs text-muted-foreground mb-1">Receita do mix hoje</p>
            <p className="text-2xl font-bold text-foreground">{formatCurrency(receitaTotal)}</p>
            <p className="text-xs text-muted-foreground mt-1">com os preços aplicados hoje</p>
          </div>
          <div className="bg-card border border-sky-300 p-4 rounded-xl shadow-sm">
            <p className="text-xs text-sky-800 mb-1">Receita do mix em {reformaConfig.ano}</p>
            <p className="text-2xl font-bold text-sky-700">{formatCurrency(receitaTotalReforma)}</p>
            <p className="text-xs text-muted-foreground mt-1">mantendo a margem de cada produto</p>
          </div>
          <div className="bg-card border border-border p-4 rounded-xl shadow-sm">
            <p className="text-xs text-muted-foreground mb-1">Variação no preço ao cliente</p>
            <p className={`text-2xl font-bold ${variacaoReceitaReforma > 0.005 ? 'text-red-600' : variacaoReceitaReforma < -0.005 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
              {variacaoReceitaReforma >= 0 ? '+' : ''}{variacaoReceitaReforma.toFixed(2)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {motorReforma.precoMuda
                ? `${motorReforma.aliquotaPorFora.toFixed(2)}% por fora + crédito de CBS no CMV`
                : 'Neste regime o preço não muda com a reforma'}
            </p>
          </div>
        </div>
      )}

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
                <th className="px-3 py-3 sticky left-0 z-30 bg-muted/95 backdrop-blur border-r border-border w-[30%] min-w-[140px] text-xs">Produto</th>
                <th className="px-2 py-3 text-center text-xs">Vendas</th>
                <th className="px-2 py-3 text-center text-xs">Rateio%</th>
                <th className="px-2 py-3 text-center text-xs">ABC</th>
                <th className="px-2 py-3 text-center text-xs">Estratégia</th>
                <th className="px-2 py-3 text-center bg-orange-50/80 text-orange-700 font-semibold text-xs border-x border-orange-200/50">Preço Sugerido</th>
                <th className="px-2 py-3 text-center bg-primary text-primary-foreground text-xs">
                  <span className="inline-flex items-center gap-1.5">
                    <Tag className="w-3 h-3" /> PREÇO APLICADO
                  </span>
                </th>
                {reformaConfig.ativo && (
                  <th className="px-2 py-3 text-center bg-sky-50/80 text-sky-700 font-semibold text-xs border-x border-sky-200/50">
                    Preço {reformaConfig.ano}
                  </th>
                )}
                <th className="px-2 py-3 text-center text-xs">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedProdutos.map((p) => {
                const isExpanded = expandedId === p.id;
                const data = [
                  { name: 'Custo Variável (CMV)', value: p.cmv },
                  { name: 'Custo Fixo Unitário', value: p.custoFixoUnitario },
                  { name: 'Impostos', value: p.valorImposto },
                  { name: 'Taxas & Despesas', value: p.valorDespesas },
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
                            {p.abaixoDoPiso && <span title={`Abaixo do piso de ${p.pisoPercent}% da faixa ${p.estrategia?.nome ?? ''}`} className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />}
                            <span className="truncate" title={p.nome}>{p.nome}</span>
                          </div>
                          <span className="text-xs text-muted-foreground mt-0.5 ml-4">CMV: {formatCurrency(p.cmv)}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="number"
                          value={p.vendas}
                          onChange={(e) => handleUpdateProduto(p.id, { vendasProjetadas: Number(e.target.value) })}
                          className="w-16 mx-auto block px-2 py-1 border border-border rounded bg-muted/30 focus:ring-2 focus:ring-primary/50 text-sm text-center"
                        />
                      </td>
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="number"
                          value={p.rateio}
                          onChange={(e) => handleUpdateProduto(p.id, { percentualRateio: Number(e.target.value) })}
                          className={`w-16 mx-auto block px-2 py-1 border rounded text-sm font-bold text-center ${p.semRateio ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-amber-300 text-amber-900'} focus:ring-2 focus:ring-amber-500/50`}
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <SeloClasseABC classe={p.classeABCLetra} />
                      </td>
                      <td className="px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                        <SeletorEstrategia
                          produto={p}
                          onChange={(updates) => handleUpdateProduto(p.id, updates)}
                          compacto
                        />
                      </td>
                      <td className="px-2 py-2 text-center bg-orange-50/40 border-x border-orange-200/30" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col items-center justify-center">
                          <span className="text-sm font-bold text-orange-700">{formatCurrency(p.precoSugerido)}</span>
                          <span className={`text-[10px] font-medium mt-0.5 ${p.valorMargemSugerido >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>L.L: {formatCurrency(p.valorMargemSugerido)} ({p.margemAlvo.toFixed(1)}%)</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-center bg-primary/5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col items-center justify-center">
                          <div className="flex items-center gap-1">
                            <PriceInput p={p} onUpdate={handleUpdateProduto} />
                            <div className="flex flex-col gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateProduto(p.id, { modoPrecificacao: 'margem' });
                                }}
                                disabled={p.modoPrecificacao !== 'preco'}
                                className={`inline-flex items-center justify-center w-6 h-6 rounded border transition-colors ${p.modoPrecificacao === 'preco' ? 'border-amber-300 bg-amber-50 text-amber-600 hover:bg-amber-100' : 'border-border bg-muted/50 text-muted-foreground/30'}`}
                                title="Restaurar preço sugerido pela margem"
                              >
                                <Undo2 className="w-3 h-3" />
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateProduto(p.id, { modoPrecificacao: 'preco', precoFixo: p.precoVenda || 0 });
                                }}
                                disabled={!p.precoVenda || (p.modoPrecificacao === 'preco' && p.precoFixo === p.precoVenda)}
                                className={`inline-flex items-center justify-center w-6 h-6 rounded border transition-colors ${(!p.precoVenda || (p.modoPrecificacao === 'preco' && p.precoFixo === p.precoVenda)) ? 'border-border bg-muted/50 text-muted-foreground/30' : 'border-emerald-300 bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                                title={`Restaurar valor de venda do cadastro${p.precoVenda ? `: ${formatCurrency(p.precoVenda)}` : ''}`}
                              >
                                <RefreshCw className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          <span className={`text-[10px] font-medium mt-1 ${p.valorMargem >= 0 ? 'text-primary' : 'text-red-600'}`}>
                            L.L: {formatCurrency(p.valorMargem)} ({p.margemReal.toFixed(1)}%)
                          </span>
                        </div>
                      </td>
                      {reformaConfig.ativo && (
                        <td className="px-2 py-2 text-center bg-sky-50/40 border-x border-sky-200/30" onClick={(e) => e.stopPropagation()}>
                          <SeloPrecoReforma
                            projecao={p.projecaoReforma}
                            precoMuda={motorReforma.precoMuda}
                            formatar={formatCurrency}
                            compacto
                          />
                        </td>
                      )}
                      <td className="px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
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
                        <td colSpan={reformaConfig.ativo ? 9 : 8} className="p-0 bg-muted/20">
                          <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
                            {/* Inputs */}
                            <div className="col-span-1 lg:col-span-4 space-y-4">
                              <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Custo de Aquisição (CMV)</label>
                                <input
                                  type="number"
                                  value={p.cmv}
                                  onChange={(e) => handleUpdateProduto(p.id, { cmv: Number(e.target.value) })}
                                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
                                />
                              </div>
                              <div className="flex gap-2 mt-4 mb-2">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateProduto(p.id, { modoPrecificacao: 'margem' })}
                                  className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded transition-colors ${(!p.modoPrecificacao || p.modoPrecificacao === 'margem') ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}
                                >
                                  Calcular por Margem
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateProduto(p.id, { modoPrecificacao: 'preco' })}
                                  className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded transition-colors ${p.modoPrecificacao === 'preco' ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}
                                >
                                  Preço Fixo
                                </button>
                              </div>

                              <div className="grid grid-cols-2 gap-4 pt-2">
                                <div>
                                  <label className="block text-xs font-medium text-muted-foreground mb-1">Impostos (%)</label>
                                  <input type="number" value={p.imposto} onChange={(e) => handleUpdateProduto(p.id, { imposto: Number(e.target.value) })} className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm" />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-muted-foreground mb-1">Taxa Cartão (%)</label>
                                  <input type="number" value={p.taxaCartao} onChange={(e) => handleUpdateProduto(p.id, { taxaCartao: Number(e.target.value) })} className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm" />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-muted-foreground mb-1">Comissão (%)</label>
                                  <input type="number" value={p.comissao} onChange={(e) => handleUpdateProduto(p.id, { comissao: Number(e.target.value) })} className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm" />
                                </div>
                                {despesasVariaveis.map(d => (
                                  <div key={d.id}>
                                    <label className="block text-xs font-medium text-muted-foreground mb-1 truncate" title={d.nome}>
                                      {d.nome} (%)
                                    </label>
                                    <input
                                      type="number"
                                      value={p.despesasVariaveis?.[d.id] ?? 0}
                                      onChange={(e) => handleUpdateProduto(p.id, {
                                        despesasVariaveis: { ...(p.despesasVariaveis || {}), [d.id]: Number(e.target.value) },
                                      })}
                                      className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
                                    />
                                  </div>
                                ))}
                                <div>
                                  {(!p.modoPrecificacao || p.modoPrecificacao === 'margem') ? (
                                    <>
                                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                                        Margem Líquida (%)
                                        {p.estrategia && (
                                          <span className="ml-1.5 font-normal normal-case">
                                            — vem de <SeloEstrategia estrategia={p.estrategia} />
                                          </span>
                                        )}
                                      </label>
                                      {/* Com uma faixa ativa, quem manda na margem é ela: o campo
                                          mostra o valor em vigor e fica travado, para não existirem
                                          dois números disputando o mesmo preço. */}
                                      <input
                                        type="number"
                                        value={p.margemAlvo}
                                        disabled={!!p.estrategia}
                                        onChange={(e) => handleUpdateProduto(p.id, { margem: Number(e.target.value) })}
                                        title={p.estrategia ? `Definida pela estratégia ${p.estrategia.nome}. Mude a faixa para "Personalizado" para editar só este produto.` : undefined}
                                        className={`w-full px-3 py-2 border border-border rounded-md font-bold text-sm focus:ring-2 focus:ring-primary/50 ${p.estrategia ? 'bg-muted/40 text-muted-foreground cursor-not-allowed' : 'bg-primary/10 text-primary'}`}
                                      />
                                      <div className="mt-1.5">
                                        <SeletorEstrategia
                                          produto={p}
                                          onChange={(updates) => handleUpdateProduto(p.id, updates)}
                                        />
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <label className="block text-xs font-medium text-muted-foreground mb-1">Preço Venda (R$)</label>
                                      <input type="number" value={p.precoFixo || 0} onChange={(e) => handleUpdateProduto(p.id, { precoFixo: Number(e.target.value) })} className="w-full px-3 py-2 border border-border rounded-md bg-primary/10 font-bold text-primary text-sm focus:ring-2 focus:ring-primary/50" />
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
                                <h3 className={`text-3xl font-bold ${p.modoPrecificacao === 'preco' ? 'text-foreground' : ''}`}>{formatCurrency(p.preco)}</h3>
                              </div>
                              <div className="bg-background border border-border p-4 rounded-xl shadow-sm">
                                {p.precoMinimo !== null && (
                                  <p className={`text-xs mt-1 font-medium ${p.abaixoDoPiso ? 'text-amber-700' : 'text-muted-foreground'}`}>
                                    Preço mínimo {formatCurrency(p.precoMinimo)} — piso de {p.pisoPercent}%
                                    {p.abaixoDoPiso && ' · o preço atual está abaixo dele'}
                                  </p>
                                )}
                                <p className="text-sm font-medium text-muted-foreground mb-1">Margem de Contribuição</p>
                                <h3 className={`text-2xl font-semibold ${p.margemContribuicao >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(p.margemContribuicao)}</h3>
                              </div>

                              {reformaConfig.ativo && (
                                <div className="bg-background border border-sky-300 p-4 rounded-xl shadow-sm">
                                  <p className="text-sm font-medium text-sky-800 mb-1">Preço em {reformaConfig.ano} — {motorReforma.preset.label}</p>
                                  {motorReforma.precoMuda ? (
                                    <>
                                      <h3 className="text-2xl font-semibold text-sky-700">{formatCurrency(p.projecaoReforma.precoMantendoMargem)}</h3>
                                      <p className={`text-xs font-medium mt-0.5 ${p.projecaoReforma.variacaoPercent > 0.005 ? 'text-red-600' : p.projecaoReforma.variacaoPercent < -0.005 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                                        {p.projecaoReforma.variacaoPercent >= 0 ? '+' : ''}{p.projecaoReforma.variacaoPercent.toFixed(2)}% vs o preço de hoje, mantendo a mesma margem
                                      </p>
                                      <div className="mt-3 pt-3 border-t border-border space-y-1">
                                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">(–) Crédito de CBS no CMV</span><span className="font-medium text-emerald-700">{formatCurrency(p.projecaoReforma.creditoCbsUnitario)}</span></div>
                                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">Imposto ainda por dentro</span><span className="font-medium">{p.projecaoReforma.impostoPorDentroRestante.toFixed(2)}%</span></div>
                                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">Receita líquida</span><span className="font-medium">{formatCurrency(p.projecaoReforma.receitaLiquida)}</span></div>
                                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">(+) CBS por fora ({p.projecaoReforma.aliquotaCbsAplicada.toFixed(2)}%)</span><span className="font-medium">{formatCurrency(p.projecaoReforma.cbsPorFora)}</span></div>
                                        <div className="flex justify-between text-xs pt-1 border-t border-border"><span className="text-muted-foreground">Margem se mantiver o preço de hoje</span><span className="font-medium">{p.projecaoReforma.margemMantendoPreco.toFixed(1)}%</span></div>
                                      </div>
                                    </>
                                  ) : (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Neste regime a guia não muda de valor, então o preço de {formatCurrency(p.preco)} continua valendo.
                                    </p>
                                  )}
                                </div>
                              )}
                              <div className="bg-background border border-border p-4 rounded-xl shadow-sm">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="text-sm font-medium text-muted-foreground mb-1">Lucro Líquido</p>
                                    <h3 className={`text-2xl font-semibold ${p.valorMargem >= 0 ? 'text-primary' : 'text-red-600'}`}>{formatCurrency(p.valorMargem)}</h3>
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
                                <p className="text-xs text-muted-foreground mt-1">Para pagar sua cota do custo fixo ({formatCurrency(p.valorRateadoCF)})</p>
                              </div>
                            </div>

                            {/* Gráfico */}
                            <div className="col-span-1 lg:col-span-4 border border-border rounded-xl p-4 bg-background flex flex-col">
                              <p className="text-sm font-medium text-foreground mb-3 text-center">Composição do Preço</p>
                              <CostCompositionChart data={data} size="sm" legendLayout="grid-2" showValues={false} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {validProdutos.length === 0 && (
                <tr>
                  <td colSpan={reformaConfig.ativo ? 7 : 6} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum produto cadastrado. Adicione produtos na aba Custos Variáveis.
                  </td>
                </tr>
              )}

              {validProdutos.length > 0 && sortedProdutos.length === 0 && (
                <tr>
                  <td colSpan={reformaConfig.ativo ? 7 : 6} className="px-4 py-8 text-center text-muted-foreground">
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

      {validProdutos.length > 0 && (
        <div className="bg-card border border-border rounded-xl shadow-sm p-6 mt-6">
          <h2 className="text-xl font-bold text-foreground mb-4 text-center">Composição de Custos do Mix de Vendas</h2>
          <div className="max-w-md mx-auto">
            <CostCompositionChart data={dataGraficoTotal} size="lg" legendLayout="list" />
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
                  <h3 className="text-xs font-semibold text-foreground mb-2">Rateio Global ({formatCurrency(custoFixoTotal)})</h3>
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
                        ? `Faltam ${rateioPendente.toFixed(1)}% (${formatCurrency(valorPendente)})`
                        : `Rateio extra de ${Math.abs(rateioPendente).toFixed(1)}%`}
                    </div>
                  )}

                  {/* O rateio pode fechar 100% e mesmo assim sobrar custo fixo
                      fora dos preços: a cota de um produto sem vendas
                      projetadas é dividida por zero unidades e não entra em
                      preço nenhum. Era o que deixava esta barra verde enquanto
                      o Dashboard fechava no vermelho. */}
                  {mix.custoFixoNaoAbsorvido > 0 && (
                    <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-800">
                      <p className="font-bold flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        {formatCurrency(mix.custoFixoNaoAbsorvido)} de custo fixo fora dos preços
                      </p>
                      <p className="mt-1 leading-relaxed">
                        {mix.produtosComRateioOcioso.length === 1
                          ? <>O produto <strong>{mix.produtosComRateioOcioso[0].nome}</strong> tem rateio mas nenhuma venda projetada, então a cota dele não entra em preço nenhum.</>
                          : <>{mix.produtosComRateioOcioso.length} produtos têm rateio mas nenhuma venda projetada, então a cota deles não entra em preço nenhum.</>}
                        {' '}Projete as vendas ou zere o rateio desses itens.
                      </p>
                      <button
                        type="button"
                        onClick={() => { setFilterMode('rateio-ocioso'); setCurrentPage(1); }}
                        className="mt-2 font-semibold underline underline-offset-2 hover:text-red-900"
                      >
                        Ver {mix.produtosComRateioOcioso.length === 1 ? 'o produto' : 'os produtos'}
                      </button>
                    </div>
                  )}

                  {/* Preço abaixo do piso: não é erro de conta, é decisão de
                      alguém — um desconto que foi longe demais. Só aparece para
                      produtos em faixa com piso definido. */}
                  {mix.produtosAbaixoDoPiso.length > 0 && (
                    <div className="mb-3 p-2.5 bg-amber-50 border border-amber-300 rounded text-xs text-amber-900">
                      <p className="font-bold flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        {mix.produtosAbaixoDoPiso.length === 1
                          ? '1 produto abaixo do piso'
                          : `${mix.produtosAbaixoDoPiso.length} produtos abaixo do piso`}
                      </p>
                      <p className="mt-1 leading-relaxed">
                        O preço aplicado entrega menos margem que o mínimo da faixa deles.
                      </p>
                      <button
                        type="button"
                        onClick={() => { setFilterMode('abaixo-piso'); setCurrentPage(1); }}
                        className="mt-2 font-semibold underline underline-offset-2 hover:text-amber-950"
                      >
                        Ver {mix.produtosAbaixoDoPiso.length === 1 ? 'o produto' : 'os produtos'}
                      </button>
                    </div>
                  )}

                  {/* Reconciliação entre esta tela e o Dashboard: enquanto
                      sobrar custo fixo descoberto, a soma das margens "no alvo"
                      de cada produto é maior que o lucro real da empresa. */}
                  {mix.custoFixoDescoberto > 0 && (
                    <p className="mb-3 text-[10px] text-muted-foreground leading-relaxed">
                      Os preços de hoje embutem {formatCurrency(mix.custoFixoAbsorvido)} dos{' '}
                      {formatCurrency(custoFixoTotal)} de custo fixo. Os{' '}
                      {formatCurrency(mix.custoFixoDescoberto)} restantes saem direto do resultado.
                    </p>
                  )}

                  <div className="flex flex-col gap-2 mt-4 border-t border-border pt-4">
                    <div className="flex flex-col gap-1.5 mb-1 p-2.5 bg-muted/20 rounded-md border border-border">
                      <span className="text-xs font-medium text-muted-foreground">Não ratear produtos com Custo (CMV) abaixo de:</span>
                      <div className="relative w-full max-w-[120px]">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">R$</span>
                        <input
                          type="number"
                          value={minRateioValor}
                          onChange={e => setMinRateioValor(e.target.value ? Number(e.target.value) : '')}
                          className="w-full pl-7 pr-2 py-1.5 text-xs font-semibold border border-border rounded-md bg-background focus:ring-2 focus:ring-primary/50"
                          placeholder="0,00"
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        Vale para os dois botões abaixo (Distribuir igual e Distribuir inteligente).
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => requestConfirm('distribuir-igual', distribuirIgualmenteNow)}
                      disabled={validProdutos.length === 0}
                      className={`inline-flex justify-center items-center gap-1.5 text-xs font-medium px-2 py-1.5 rounded border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                        confirmingAction === 'distribuir-igual'
                          ? 'border-amber-400 bg-amber-500 text-white'
                          : 'border-border bg-background hover:bg-muted/50'
                      }`}
                      title="Divide 100% igualmente entre os produtos que atingirem o custo mínimo e tiverem vendas projetadas"
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      {confirmingAction === 'distribuir-igual' ? 'Confirmar?' : 'Distribuir igual'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPesoConfig(v => !v)}
                      disabled={validProdutos.length === 0}
                      className={`inline-flex justify-center items-center gap-1.5 text-xs font-medium px-2 py-1.5 rounded border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                        showPesoConfig
                          ? 'border-amber-400 bg-amber-500 text-white'
                          : 'border-border bg-background hover:bg-muted/50'
                      }`}
                      title="Divide o rateio por um índice ponderado (volume de vendas, receita e capacidade de gerar lucro) — os pesos são ajustáveis"
                    >
                      <BrainCircuit className="w-3.5 h-3.5" />
                      Distribuir inteligente
                      {showPesoConfig ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    {showPesoConfig && (
                      <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-3">
                        <p className="text-[11px] text-muted-foreground">
                          Ajuste o peso de cada critério (não precisa somar 100% — é normalizado automaticamente):
                        </p>

                        <div className="space-y-2.5">
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="font-medium text-foreground">Volume de vendas</span>
                              <span className="font-semibold text-primary">{pesos.vendas}%</span>
                            </div>
                            <input
                              type="range" min={0} max={100} value={pesos.vendas}
                              onChange={e => setPesos(p => ({ ...p, vendas: Number(e.target.value) }))}
                              className="w-full accent-primary"
                            />
                          </div>
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="font-medium text-foreground">Receita</span>
                              <span className="font-semibold text-primary">{pesos.receita}%</span>
                            </div>
                            <input
                              type="range" min={0} max={100} value={pesos.receita}
                              onChange={e => setPesos(p => ({ ...p, receita: Number(e.target.value) }))}
                              className="w-full accent-primary"
                            />
                          </div>
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="font-medium text-foreground">Capacidade de gerar lucro</span>
                              <span className="font-semibold text-primary">{pesos.lucro}%</span>
                            </div>
                            <input
                              type="range" min={0} max={100} value={pesos.lucro}
                              onChange={e => setPesos(p => ({ ...p, lucro: Number(e.target.value) }))}
                              className="w-full accent-primary"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border">
                          <span className="text-muted-foreground">Soma atual</span>
                          <span className={`font-semibold ${somaPesos === 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {somaPesos}%
                          </span>
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => requestConfirm('distribuir-inteligente-aplicar', () => {
                              distribuirInteligentemente(pesos);
                              setShowPesoConfig(false);
                            })}
                            disabled={validProdutos.length === 0 || somaPesos === 0}
                            className={`flex-1 inline-flex justify-center items-center gap-1.5 text-xs font-medium px-2 py-1.5 rounded border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                              confirmingAction === 'distribuir-inteligente-aplicar'
                                ? 'border-amber-400 bg-amber-500 text-white'
                                : 'border-primary bg-primary text-primary-foreground hover:bg-primary/90'
                            }`}
                          >
                            {confirmingAction === 'distribuir-inteligente-aplicar' ? 'Confirmar?' : 'Aplicar distribuição'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setPesos({ vendas: 30, receita: 30, lucro: 40 })}
                            className="text-xs font-medium px-2 py-1.5 rounded border border-border bg-background hover:bg-muted/50"
                          >
                            Padrão
                          </button>
                        </div>
                      </div>
                    )}
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
                      <p className="text-sm font-bold text-foreground">{formatCurrency(receitaTotal)}</p>
                    </div>
                    <div className="p-2 rounded border border-border bg-background">
                      <p className="text-[10px] text-muted-foreground mb-0.5">M.C. Total</p>
                      <p className="text-sm font-bold text-emerald-600">{formatCurrency(margemTotal)}</p>
                    </div>
                    <div className={`p-2 rounded border ${lucroMix >= 0 ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
                      <p className={`text-[10px] font-medium mb-0.5 ${lucroMix >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>Resultado</p>
                      <p className={`text-sm font-bold ${lucroMix >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatCurrency(lucroMix)}</p>
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