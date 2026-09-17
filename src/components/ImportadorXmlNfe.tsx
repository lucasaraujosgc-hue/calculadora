import React, { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownToLine,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileCode2,
  Info,
  Trash2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { formatCurrency } from '../utils/format';
import { sugerirCadastro } from '../domain/fiscal/agregacao';
import type { ResumoProduto } from '../domain/fiscal/tipos';

interface NotaImportada {
  chave: string;
  numero: string;
  direcao: 'compra' | 'venda';
  motivo: string;
  competencia: string;
  itens: number;
  valorTotal: number;
}

interface DocumentoListado {
  id: string;
  numero: string;
  serie: string;
  direcao: 'compra' | 'venda';
  competencia: string;
  dataEmissao: string;
  participante: string | null;
  valorTotal: number;
  nomeArquivo: string | null;
}

interface ResultadoImport {
  importadas: NotaImportada[];
  ignoradas: { arquivo: string; motivo: string }[];
  totalCompras: number;
  totalVendas: number;
}

/** AAAA-MM → "mai/2026". */
function rotuloCompetencia(competencia: string): string {
  const [ano, mes] = competencia.split('-');
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const i = Number(mes) - 1;
  return `${nomes[i] ?? mes}/${ano}`;
}

function formatarDocumento(doc: string): string {
  const d = doc.replace(/\D/g, '');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  return doc;
}

function Variacao({ valor }: { valor: number | null }) {
  if (valor === null || Math.abs(valor) < 0.005) return <span className="text-muted-foreground">—</span>;
  const subiu = valor > 0;
  return (
    <span className={`inline-flex items-center gap-1 font-medium ${subiu ? 'text-red-600' : 'text-emerald-600'}`}>
      {subiu ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {subiu ? '+' : ''}{valor.toFixed(1)}%
    </span>
  );
}

export default function ImportadorXmlNfe() {
  const { user, isGuest } = useAppContext();

  const [aberto, setAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImport | null>(null);
  const [erro, setErro] = useState('');

  const [competencias, setCompetencias] = useState<string[]>([]);
  const [produtos, setProdutos] = useState<ResumoProduto[]>([]);
  const [carregandoResumo, setCarregandoResumo] = useState(false);

  // '' = usa o movimento mais recente de cada produto.
  const [competenciaEscolhida, setCompetenciaEscolhida] = useState('');
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [expandido, setExpandido] = useState<string | null>(null);

  const [documentos, setDocumentos] = useState<DocumentoListado[]>([]);
  const [mostrarNotas, setMostrarNotas] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [avisoAplicacao, setAvisoAplicacao] = useState('');

  const temDocumento = !!user?.taxId;

  const carregarResumo = useCallback(async () => {
    if (!user || isGuest) return;
    setCarregandoResumo(true);
    try {
      const res = await fetch('/api/fiscal/resumo');
      if (res.ok) {
        const data = await res.json();
        setCompetencias(data.competencias || []);
        setProdutos(data.produtos || []);
      }
    } catch {
      // Sem conexão: a tela simplesmente fica sem o resumo.
    } finally {
      setCarregandoResumo(false);
    }
  }, [user, isGuest]);

  const carregarDocumentos = useCallback(async () => {
    if (!user || isGuest) return;
    try {
      const res = await fetch('/api/fiscal/documentos');
      if (res.ok) setDocumentos(await res.json());
    } catch { /* silencioso */ }
  }, [user, isGuest]);

  // Carrega ao abrir o painel, não num efeito: assim a busca acontece por causa
  // do clique e não volta a rodar a cada renderização.
  const alternarPainel = () => {
    const proximo = !aberto;
    setAberto(proximo);
    if (proximo) {
      carregarResumo();
      carregarDocumentos();
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivos = e.target.files;
    if (!arquivos || arquivos.length === 0) return;

    setEnviando(true);
    setErro('');
    setResultado(null);

    const form = new FormData();
    for (const arquivo of Array.from(arquivos)) form.append('files', arquivo);

    try {
      const res = await fetch('/api/fiscal/import', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error || 'Erro ao importar os XMLs.');
      } else {
        setResultado(data);
        await carregarResumo();
        await carregarDocumentos();
      }
    } catch {
      setErro('Erro de conexão ao enviar os arquivos.');
    } finally {
      setEnviando(false);
      if (e.target) e.target.value = '';
    }
  };

  const sugestoes = useMemo(() => {
    const mapa = new Map<string, ReturnType<typeof sugerirCadastro>>();
    for (const p of produtos) {
      mapa.set(p.chaveProduto, sugerirCadastro(p, competenciaEscolhida || undefined));
    }
    return mapa;
  }, [produtos, competenciaEscolhida]);

  // Só faz sentido aplicar produtos que têm algum valor apurado no período.
  const produtosAplicaveis = useMemo(
    () => produtos.filter(p => {
      const s = sugestoes.get(p.chaveProduto);
      return s && (s.cmv > 0 || s.precoVenda > 0);
    }),
    [produtos, sugestoes]
  );

  const alternarSelecao = (chave: string) => {
    setSelecionados(prev => {
      const proximo = new Set(prev);
      if (proximo.has(chave)) proximo.delete(chave);
      else proximo.add(chave);
      return proximo;
    });
  };

  const selecionarTodos = () => {
    setSelecionados(prev =>
      prev.size === produtosAplicaveis.length
        ? new Set()
        : new Set(produtosAplicaveis.map(p => p.chaveProduto))
    );
  };

  const aplicarAoCadastro = async () => {
    const escolhidos = produtosAplicaveis.filter(p => selecionados.has(p.chaveProduto));
    if (escolhidos.length === 0) return;

    setAplicando(true);
    setAvisoAplicacao('');
    try {
      const payload = escolhidos.map(p => {
        const s = sugestoes.get(p.chaveProduto)!;
        return {
          nome: p.descricao,
          cmv: s.cmv,
          precoVenda: s.precoVenda,
          vendasProjetadas: s.vendasProjetadas,
        };
      });
      const res = await fetch('/api/fiscal/aplicar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ produtos: payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAvisoAplicacao(data.error || 'Erro ao aplicar os valores.');
      } else {
        const partes = [];
        if (data.criados > 0) partes.push(`${data.criados} produto(s) criado(s)`);
        if (data.atualizados > 0) partes.push(`${data.atualizados} atualizado(s)`);
        let msg = partes.length > 0 ? `${partes.join(' e ')}.` : 'Nada mudou.';
        if (data.semEspaco?.length > 0) {
          msg += ` ${data.semEspaco.length} produto(s) não couberam no limite do seu plano.`;
        }
        setAvisoAplicacao(`${msg} Recarregue a página para ver a lista atualizada.`);
        setSelecionados(new Set());
      }
    } catch {
      setAvisoAplicacao('Erro de conexão ao aplicar os valores.');
    } finally {
      setAplicando(false);
    }
  };

  const apagarNota = async (id: string) => {
    await fetch(`/api/fiscal/documentos/${id}`, { method: 'DELETE' });
    await carregarResumo();
    await carregarDocumentos();
  };

  const apagarTudo = async () => {
    await fetch('/api/fiscal/documentos', { method: 'DELETE' });
    setResultado(null);
    setSelecionados(new Set());
    await carregarResumo();
    await carregarDocumentos();
  };

  if (isGuest || !user) {
    return (
      <div className="bg-card border border-border rounded-xl shadow-sm p-5">
        <div className="flex items-start gap-3">
          <FileCode2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-foreground">Importar notas fiscais (XML)</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Crie uma conta para importar os XMLs das suas notas de compra e venda e deixar o sistema preencher custo,
              preço e volume de cada produto sozinho.
            </p>
            <Link to="/auth" className="inline-block mt-3 bg-primary text-primary-foreground px-3 py-1.5 rounded text-xs font-bold hover:bg-primary/90 transition-colors">
              Fazer Cadastro / Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-sky-300 rounded-xl shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={alternarPainel}
        className="w-full flex items-center justify-between gap-3 p-5 text-left"
      >
        <span className="flex items-start gap-3">
          <FileCode2 className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
          <span>
            <span className="block font-medium text-foreground">Importar notas fiscais (XML)</span>
            <span className="block text-sm text-muted-foreground mt-0.5">
              Envie os XMLs de compra e de venda juntos. O sistema separa pelo seu CNPJ/CPF e apura custo e preço médio
              mês a mês.
            </span>
          </span>
        </span>
        {aberto ? <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" /> : <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />}
      </button>

      {aberto && (
        <div className="px-5 pb-5 space-y-5 border-t border-border pt-5">
          {/* ---------------- CNPJ/CPF ---------------- */}
          {!temDocumento ? (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
              <div>
                <p className="font-semibold mb-1">Falta cadastrar o CNPJ ou CPF da empresa</p>
                <p className="mb-2">
                  É ele que diz, em cada nota, se você é o emitente (venda) ou o destinatário (compra). Sem isso não dá
                  para classificar os arquivos.
                </p>
                <Link to="/configuracoes" className="inline-block bg-amber-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-amber-700 transition-colors">
                  Cadastrar em Minha Conta
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <p className="text-sm text-muted-foreground flex-1">
                Classificando as notas pelo documento <strong className="text-foreground">{formatarDocumento(user.taxId!)}</strong>.
              </p>
              <label className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium cursor-pointer transition-colors ${enviando ? 'bg-muted text-muted-foreground cursor-wait' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}>
                <ArrowDownToLine className="w-4 h-4" />
                {enviando ? 'Lendo os XMLs...' : 'Selecionar XMLs'}
                <input
                  type="file"
                  accept=".xml,text/xml,application/xml"
                  multiple
                  onChange={handleUpload}
                  disabled={enviando}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {erro && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">{erro}</p>
          )}

          {/* ---------------- Resultado da importação ---------------- */}
          {resultado && (
            <div className="p-4 bg-muted/40 border border-border rounded-lg space-y-3">
              <div className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-foreground">
                  <strong>{resultado.importadas.length}</strong> nota(s) importada(s) —{' '}
                  {resultado.totalCompras} de compra e {resultado.totalVendas} de venda.
                </span>
              </div>
              {resultado.ignoradas.length > 0 && (
                <div className="text-sm">
                  <p className="text-amber-800 font-medium mb-1">
                    {resultado.ignoradas.length} arquivo(s) não entraram:
                  </p>
                  <ul className="space-y-1 max-h-40 overflow-y-auto">
                    {resultado.ignoradas.map((i, idx) => (
                      <li key={`${i.arquivo}-${idx}`} className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{i.arquivo}</span> — {i.motivo}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* ---------------- Resumo por produto e período ---------------- */}
          {carregandoResumo && <p className="text-sm text-muted-foreground">Carregando o resumo...</p>}

          {!carregandoResumo && produtos.length === 0 && temDocumento && (
            <div className="flex items-start gap-2 p-3 bg-muted/50 border border-border rounded-md text-xs text-muted-foreground">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Nenhuma nota importada ainda. Baixe os XMLs no portal da sua contabilidade ou no site da SEFAZ e envie
                aqui — pode mandar compras e vendas de vários meses de uma vez.
              </span>
            </div>
          )}

          {produtos.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-col lg:flex-row lg:items-end gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Período de referência</label>
                  <select
                    value={competenciaEscolhida}
                    onChange={e => { setCompetenciaEscolhida(e.target.value); setSelecionados(new Set()); }}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="">Movimento mais recente de cada produto</option>
                    {competencias.map(c => (
                      <option key={c} value={c}>{rotuloCompetencia(c)}</option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    O mesmo produto muda de preço de um mês para o outro — escolha de qual competência vêm o custo e o
                    preço que serão aplicados.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={selecionarTodos}
                    className="px-3 py-2 border border-border rounded-md text-sm font-medium hover:bg-muted transition-colors"
                  >
                    {selecionados.size === produtosAplicaveis.length ? 'Limpar seleção' : 'Selecionar todos'}
                  </button>
                  <button
                    type="button"
                    onClick={aplicarAoCadastro}
                    disabled={selecionados.size === 0 || aplicando}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {aplicando ? 'Aplicando...' : `Aplicar ao cadastro (${selecionados.size})`}
                  </button>
                </div>
              </div>

              {avisoAplicacao && (
                <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md p-3">{avisoAplicacao}</p>
              )}

              <div className="border border-border rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-[28rem] overflow-y-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted/80 text-muted-foreground font-medium border-b border-border sticky top-0 z-10">
                      <tr>
                        <th className="px-3 py-2 text-xs w-8"></th>
                        <th className="px-3 py-2 text-xs">Produto</th>
                        <th className="px-2 py-2 text-xs text-right">Custo médio</th>
                        <th className="px-2 py-2 text-xs text-right">Preço médio</th>
                        <th className="px-2 py-2 text-xs text-right">Margem bruta</th>
                        <th className="px-2 py-2 text-xs text-right">Custo no período</th>
                        <th className="px-2 py-2 text-xs text-right">Preço no período</th>
                        <th className="px-2 py-2 text-xs w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {produtos.map(p => {
                        const s = sugestoes.get(p.chaveProduto)!;
                        const aplicavel = s.cmv > 0 || s.precoVenda > 0;
                        const margem = s.cmv > 0 && s.precoVenda > 0
                          ? ((s.precoVenda - s.cmv) / s.precoVenda) * 100
                          : null;
                        const estaExpandido = expandido === p.chaveProduto;

                        return (
                          <React.Fragment key={p.chaveProduto}>
                            <tr className={`hover:bg-muted/30 ${!aplicavel ? 'opacity-60' : ''}`}>
                              <td className="px-3 py-2">
                                <input
                                  type="checkbox"
                                  checked={selecionados.has(p.chaveProduto)}
                                  onChange={() => alternarSelecao(p.chaveProduto)}
                                  disabled={!aplicavel}
                                  className="w-4 h-4 accent-current"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <span className="font-medium text-foreground block truncate max-w-[22rem]" title={p.descricao}>
                                  {p.descricao}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {p.ean ? `EAN ${p.ean}` : 'sem GTIN — casado pela descrição'}
                                  {p.unidade ? ` · ${p.unidade}` : ''}
                                </span>
                              </td>
                              <td className="px-2 py-2 text-right font-medium whitespace-nowrap">
                                {s.cmv > 0 ? formatCurrency(s.cmv) : '—'}
                              </td>
                              <td className="px-2 py-2 text-right font-medium whitespace-nowrap">
                                {s.precoVenda > 0 ? formatCurrency(s.precoVenda) : '—'}
                              </td>
                              <td className="px-2 py-2 text-right whitespace-nowrap">
                                {margem === null
                                  ? <span className="text-muted-foreground">—</span>
                                  : <span className={margem >= 0 ? 'text-emerald-600 font-medium' : 'text-red-600 font-medium'}>{margem.toFixed(1)}%</span>}
                              </td>
                              <td className="px-2 py-2 text-right whitespace-nowrap text-xs">
                                <Variacao valor={p.variacaoCustoPercent} />
                              </td>
                              <td className="px-2 py-2 text-right whitespace-nowrap text-xs">
                                <Variacao valor={p.variacaoPrecoPercent} />
                              </td>
                              <td className="px-2 py-2">
                                <button
                                  type="button"
                                  onClick={() => setExpandido(estaExpandido ? null : p.chaveProduto)}
                                  title="Ver o histórico mês a mês"
                                  className={`inline-flex items-center justify-center w-6 h-6 rounded border transition-colors ${estaExpandido ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
                                >
                                  {estaExpandido ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                </button>
                              </td>
                            </tr>

                            {estaExpandido && (
                              <tr>
                                <td colSpan={8} className="bg-muted/20 p-4">
                                  <p className="text-xs font-medium text-foreground mb-2">
                                    Histórico mês a mês
                                    {p.codigos.length > 0 && (
                                      <span className="font-normal text-muted-foreground"> · códigos nas notas: {p.codigos.join(', ')}</span>
                                    )}
                                  </p>
                                  <table className="w-full text-xs">
                                    <thead className="text-muted-foreground">
                                      <tr className="border-b border-border">
                                        <th className="py-1.5 text-left font-medium">Competência</th>
                                        <th className="py-1.5 text-right font-medium">Qtd. comprada</th>
                                        <th className="py-1.5 text-right font-medium">Custo médio</th>
                                        <th className="py-1.5 text-right font-medium">Qtd. vendida</th>
                                        <th className="py-1.5 text-right font-medium">Preço médio</th>
                                        <th className="py-1.5 text-right font-medium">Margem bruta</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {p.periodos.map(per => (
                                        <tr key={per.competencia} className="border-b border-border/50">
                                          <td className="py-1.5 font-medium text-foreground">
                                            {rotuloCompetencia(per.competencia)}
                                            {per.itensIgnorados > 0 && (
                                              <span
                                                className="ml-1 text-amber-700"
                                                title="Itens de devolução, transferência ou remessa ficaram fora da média"
                                              >
                                                ({per.itensIgnorados} fora da média)
                                              </span>
                                            )}
                                          </td>
                                          <td className="py-1.5 text-right">{per.quantidadeComprada > 0 ? per.quantidadeComprada.toLocaleString('pt-BR') : '—'}</td>
                                          <td className="py-1.5 text-right">{per.custoMedio > 0 ? formatCurrency(per.custoMedio) : '—'}</td>
                                          <td className="py-1.5 text-right">{per.quantidadeVendida > 0 ? per.quantidadeVendida.toLocaleString('pt-BR') : '—'}</td>
                                          <td className="py-1.5 text-right">{per.precoMedio > 0 ? formatCurrency(per.precoMedio) : '—'}</td>
                                          <td className="py-1.5 text-right">
                                            {per.margemBrutaPercent === null
                                              ? '—'
                                              : <span className={per.margemBrutaPercent >= 0 ? 'text-emerald-600' : 'text-red-600'}>{per.margemBrutaPercent.toFixed(1)}%</span>}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 bg-muted/50 border border-border rounded-md text-xs text-muted-foreground">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  O custo médio já inclui frete, seguro, outras despesas, IPI e ICMS-ST da nota, descontado o desconto —
                  é o custo de aquisição de verdade. Devoluções, transferências e remessas ficam fora das médias para não
                  distorcer o preço. As médias são ponderadas pela quantidade.
                </span>
              </div>
            </div>
          )}

          {/* ---------------- Notas importadas ---------------- */}
          {documentos.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setMostrarNotas(v => !v)}
                className="text-sm font-medium text-primary hover:underline"
              >
                {mostrarNotas ? 'Ocultar' : 'Ver'} as {documentos.length} nota(s) importada(s)
              </button>

              {mostrarNotas && (
                <div className="mt-3 border border-border rounded-lg overflow-hidden">
                  <div className="max-h-64 overflow-y-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted/80 text-muted-foreground font-medium border-b border-border sticky top-0">
                        <tr>
                          <th className="px-3 py-2">Nota</th>
                          <th className="px-2 py-2">Tipo</th>
                          <th className="px-2 py-2">Competência</th>
                          <th className="px-2 py-2">Participante</th>
                          <th className="px-2 py-2 text-right">Valor</th>
                          <th className="px-2 py-2 w-8"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {documentos.map(d => (
                          <tr key={d.id} className="hover:bg-muted/30">
                            <td className="px-3 py-2 font-medium text-foreground">nº {d.numero}/{d.serie}</td>
                            <td className="px-2 py-2">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${d.direcao === 'compra' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                {d.direcao === 'compra' ? 'COMPRA' : 'VENDA'}
                              </span>
                            </td>
                            <td className="px-2 py-2">{rotuloCompetencia(d.competencia)}</td>
                            <td className="px-2 py-2 truncate max-w-[16rem]" title={d.participante || ''}>{d.participante || '—'}</td>
                            <td className="px-2 py-2 text-right">{formatCurrency(d.valorTotal)}</td>
                            <td className="px-2 py-2">
                              <button
                                type="button"
                                onClick={() => apagarNota(d.id)}
                                title="Remover esta nota"
                                className="text-muted-foreground hover:text-red-600 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="p-2 border-t border-border bg-muted/30 text-right">
                    <button
                      type="button"
                      onClick={apagarTudo}
                      className="text-xs font-medium text-red-600 hover:underline"
                    >
                      Apagar todas as notas importadas
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
