import React, { useMemo, useState } from 'react';
import { BarChart3, Info } from 'lucide-react';
import {
  CRITERIOS,
  CORTE_A,
  CORTE_B,
  sugerirMapeamento,
  type ClasseABC,
  type CriterioABC,
  type MapeamentoABC,
  type ResultadoABC,
} from '../domain/abc';
import type { ResultadoMix } from '../domain/pricing';
import {
  elasticidadeDeEquilibrioDoMix,
  vereditoDoCorte,
  ELASTICIDADE_REFERENCIA_VAREJO,
  type ItemEquilibrio,
} from '../domain/elasticidade/equilibrio';
import { useAppContext } from '../context/AppContext';
import { formatCurrency } from '../utils/format';

/**
 * Curva ABC do mix e sugestão de estratégia por classe.
 *
 * O sistema faz a parte trabalhosa — descobrir quais produtos respondem pelo
 * grosso do resultado — e o usuário toma a decisão comercial: qual faixa de
 * margem cabe a cada classe. Nada é aplicado sem ele confirmar, e a prévia diz
 * quantos produtos mudam antes de mudar.
 */

/**
 * Escala sequencial (A mais escuro -> C mais claro), porque A, B e C são uma
 * ordem de importância, não categorias soltas. Escala validada para separação
 * em daltonismo; ainda assim a classe sempre aparece escrita, nunca só pela cor.
 */
const CORES_ABC: Record<ClasseABC, { fill: string; selo: string }> = {
  A: { fill: '#4c1d95', selo: 'bg-violet-100 text-violet-900 border-violet-300' },
  B: { fill: '#7c3aed', selo: 'bg-violet-50 text-violet-800 border-violet-200' },
  C: { fill: '#a78bfa', selo: 'bg-slate-50 text-slate-600 border-slate-200' },
};

/**
 * Nome e explicação de cada classe, em português de balcão.
 *
 * "Cauda longa" e "os primeiros 80% do acumulado" são jargão de quem já sabe o
 * que é curva ABC. Quem abre esta tela pela primeira vez precisa saber o que o
 * grupo significa para a loja dele, não como o corte foi calculado.
 */
const CLASSES: Record<ClasseABC, { titulo: string; explicacao: string }> = {
  A: {
    titulo: 'Seus campeões',
    explicacao: `Poucos produtos que, somados, fazem os primeiros ${CORTE_A}% do total. São os que o cliente conhece de cor e compara de loja em loja.`,
  },
  B: {
    titulo: 'O meio do caminho',
    explicacao: `Vêm logo depois e completam até ${CORTE_B}%. Vendem bem, mas não sustentam a loja sozinhos.`,
  },
  C: {
    titulo: 'O resto do catálogo',
    explicacao: 'Muitos produtos, cada um com pouca participação. Juntos não chegam a 5% — e quase ninguém confere o preço deles.',
  },
};

/** Selo da classe para a tabela do Mix. */
export function SeloClasseABC({ classe }: { classe?: ClasseABC }) {
  if (!classe) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <span
      className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold border ${CORES_ABC[classe].selo}`}
      title={`Classe ${classe} — ${CLASSES[classe].titulo}. ${CLASSES[classe].explicacao}`}
    >
      {classe}
    </span>
  );
}

export default function CurvaABC({
  abc,
  criterio,
  setCriterio,
  onAplicar,
  onSimular,
  onItensEquilibrio,
  receitaAtual,
  lucroAtual,
}: {
  abc: ResultadoABC;
  criterio: CriterioABC;
  setCriterio: (c: CriterioABC) => void;
  onAplicar: (mapa: MapeamentoABC) => void;
  /** Roda o mix como ficaria com este mapeamento, sem aplicar. */
  onSimular: (mapa: MapeamentoABC) => ResultadoMix<any>;
  /** Preço de hoje contra o proposto, para a conta de equilíbrio. */
  onItensEquilibrio: (mapa: MapeamentoABC) => ItemEquilibrio[];
  receitaAtual: number;
  lucroAtual: number;
}) {
  const { estrategias, produtos } = useAppContext();

  const sugestao = useMemo(() => sugerirMapeamento(estrategias), [estrategias]);
  const [mapa, setMapa] = useState<MapeamentoABC>(sugestao);
  const [confirmando, setConfirmando] = useState(false);

  // A sugestão muda quando o usuário mexe nas faixas; o mapeamento acompanha
  // enquanto ele não tiver escolhido nada à mão.
  const [tocado, setTocado] = useState(false);
  const mapaEfetivo = tocado ? mapa : sugestao;

  const formatarValor = (v: number) =>
    criterio === 'quantidade' ? `${Math.round(v).toLocaleString('pt-BR')} un` : formatCurrency(v);

  // Quantos produtos realmente mudariam de faixa — é o número que diz se vale
  // apertar o botão, e evita a aplicação às cegas no catálogo inteiro.
  const mudariam = useMemo(() => produtos.filter(p => {
    const classe = abc.porId[p.id]?.classe;
    if (!classe) return false;
    const destino = mapaEfetivo[classe];
    return !!destino && p.estrategiaId !== destino;
  }).length, [produtos, abc, mapaEfetivo]);

  // Prévia do impacto. Mover a classe A para uma faixa de margem menor barateia
  // justamente os produtos que mais vendem, e isso derruba o resultado bem mais
  // do que a diferença de pontos percentuais sugere. O número tem que estar na
  // tela ANTES do clique.
  const simulacao = useMemo(() => (mudariam > 0 ? onSimular(mapaEfetivo) : null), [mudariam, mapaEfetivo, onSimular]);
  const deltaLucro = simulacao ? simulacao.lucroLiquidoTotal - lucroAtual : 0;
  const deltaLucroPercent = simulacao && lucroAtual !== 0
    ? (deltaLucro / Math.abs(lucroAtual)) * 100
    : 0;
  const deltaReceita = simulacao ? simulacao.receitaTotal - receitaAtual : 0;

  // Quanto o volume teria que reagir para o corte se pagar sozinho. Sai de
  // preço, custo e deduções — não de histórico —, então vale para todo mundo.
  const equilibrio = useMemo(
    () => (mudariam > 0 ? elasticidadeDeEquilibrioDoMix(onItensEquilibrio(mapaEfetivo)) : null),
    [mudariam, mapaEfetivo, onItensEquilibrio]
  );
  const veredito = equilibrio ? vereditoDoCorte(equilibrio) : 'nao-se-aplica';

  const semDados = abc.total <= 0;
  const criterioAtual = CRITERIOS.find(c => c.id === criterio)!;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <BarChart3 className="w-4 h-4 text-primary" /> Curva ABC do seu mix
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
          A curva ABC enfileira seus produtos do que mais pesa para o que menos pesa e corta a fila em
          três grupos. Quase sempre um punhado deles responde pela maior parte do resultado — e são
          justamente esses que o cliente conhece de cor e compara de loja em loja.
        </p>
        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
          Serve para você não dar a mesma margem para todo mundo: quem puxa cliente para dentro pede
          preço competitivo, quem ninguém confere é onde a margem passa despercebida.
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Calcular a curva por</label>
        <select
          value={criterio}
          onChange={e => setCriterio(e.target.value as CriterioABC)}
          className="w-full sm:w-auto px-3 py-2 border border-border rounded-lg bg-background text-sm focus:ring-2 focus:ring-primary/50"
        >
          {CRITERIOS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <p className="text-[11px] text-muted-foreground mt-1">{criterioAtual.descricao}</p>
      </div>

      {semDados ? (
        <p className="text-xs text-muted-foreground flex items-start gap-1.5 p-3 rounded-lg bg-muted/30 border border-border">
          <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
          Ainda não há {criterioAtual.label.toLowerCase()} para classificar. Preencha as vendas projetadas
          dos produtos — ou importe suas notas fiscais — e a curva aparece aqui.
        </p>
      ) : (
        <>
          {/* Barra de proporção: a fatia de cada classe no total, com rótulo
              direto em cada faixa que couber — a cor nunca carrega o dado
              sozinha. O vão de 2px separa os segmentos. */}
          <div>
            <div className="flex w-full h-8 rounded-lg overflow-hidden gap-[2px] bg-background">
              {abc.resumo.filter(c => c.participacao > 0).map(c => (
                <div
                  key={c.classe}
                  style={{ width: `${c.participacao}%`, backgroundColor: CORES_ABC[c.classe].fill }}
                  title={`Classe ${c.classe}: ${c.quantidade} produto(s), ${formatarValor(c.valor)} (${c.participacao.toFixed(1)}%)`}
                  className="flex items-center justify-center min-w-0 first:rounded-l-lg last:rounded-r-lg"
                >
                  {c.participacao >= 8 && (
                    <span className="text-[11px] font-bold text-white px-1 whitespace-nowrap overflow-hidden text-ellipsis">
                      {c.classe} · {c.participacao.toFixed(0)}%
                      {c.participacao >= 20 && ` · ${c.quantidade} ${c.quantidade === 1 ? 'produto' : 'produtos'}`}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
              Largura de cada faixa = quanto o grupo pesa em {criterioAtual.label.toLowerCase()}.
              Total de {formatarValor(abc.total)}.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {abc.resumo.map(c => (
              <div key={c.classe} className="p-3 rounded-xl border border-border bg-background flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: CORES_ABC[c.classe].fill }} />
                  <span className="text-xs font-bold text-foreground">
                    Classe {c.classe} · {CLASSES[c.classe].titulo}
                  </span>
                </div>

                {/* Sem truncate: a explicação da classe é justamente o que faltava
                    para a tela ser entendida, e cortá-la a meia frase é pior do
                    que ocupar duas linhas. */}
                {/* Altura mínima só nos três lado a lado: sem ela, a explicação
                    mais curta puxa o número da classe B para cima e as três
                    colunas ficam desencontradas. Empilhado, não faz sentido. */}
                <p className="text-[10px] text-muted-foreground leading-relaxed mt-1 sm:min-h-[3.75rem]">
                  {CLASSES[c.classe].explicacao}
                </p>

                <p className="text-xl font-bold text-foreground leading-tight mt-2">
                  {c.quantidade}
                  <span className="text-xs font-medium text-muted-foreground ml-1">
                    {c.quantidade === 1 ? 'produto' : 'produtos'}
                  </span>
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {c.participacao.toFixed(1)}% do total · {formatarValor(c.valor)}
                </p>

                <div className="mt-auto pt-2.5 border-t border-border">
                  <label className="block text-[10px] font-medium text-muted-foreground mb-1 mt-2.5">
                    Estratégia sugerida
                  </label>
                  <select
                    value={mapaEfetivo[c.classe] ?? ''}
                    onChange={e => {
                      setTocado(true);
                      setMapa({ ...mapaEfetivo, [c.classe]: e.target.value || null });
                    }}
                    className="w-full px-2 py-1.5 border border-border rounded bg-background text-xs focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="">Não mexer</option>
                    {estrategias.map(e => (
                      <option key={e.id} value={e.id}>{e.nome} · {e.margem}%</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>

          {equilibrio && equilibrio.elasticidade !== null && veredito !== 'nao-se-aplica' && (
            <div className={`p-3 rounded-xl border ${veredito === 'improvavel' ? 'bg-amber-50 border-amber-300' : 'bg-emerald-50 border-emerald-200'}`}>
              <p className="text-xs font-bold text-foreground">
                {veredito === 'improvavel'
                  ? 'Este desconto não se paga no volume destes produtos'
                  : 'Este desconto pode se pagar em volume'}
              </p>
              <p className="text-xs mt-1.5 leading-relaxed">
                Para empatar, o volume teria que reagir com elasticidade{' '}
                <strong>{equilibrio.elasticidade.toFixed(1)}</strong> — ou seja, subir{' '}
                <strong>{equilibrio.aumentoVolumeNecessarioPercent?.toFixed(0)}%</strong>.
                {veredito === 'improvavel'
                  ? ` No varejo, mesmo os itens mais sensíveis a preço raramente passam de ${ELASTICIDADE_REFERENCIA_VAREJO.toFixed(0)}.`
                  : ' Está dentro do que itens sensíveis a preço costumam entregar.'}
              </p>
              <p className="text-[11px] mt-2 leading-relaxed text-muted-foreground">
                O preço cai {Math.abs(equilibrio.variacaoPrecoPercent).toFixed(0)}%, mas a margem que
                sobra para pagar as contas cai{' '}
                {Math.abs(equilibrio.variacaoMargemContribuicaoPercent).toFixed(0)}% — o custo não
                acompanha o desconto. É por isso que a conta é mais dura do que parece, e o que manda
                é o nível da sua margem, não o tamanho do corte.
              </p>
              {veredito === 'improvavel' && (
                <p className="text-[11px] mt-2 leading-relaxed text-amber-900">
                  Isso não quer dizer que o preço de atração seja errado — quer dizer que ele não se
                  paga <em>neste item</em>. Quem paga um produto de atração é a cesta que o cliente
                  leva junto, e isso nenhuma conta aqui mede. Decida sabendo disso.
                </p>
              )}
            </div>
          )}

          {simulacao && (
            <div className={`p-3 rounded-xl border ${deltaLucro < 0 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
              <p className="text-xs font-semibold text-foreground mb-2">Se aplicar, o mix fica assim</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-muted-foreground">Receita projetada</p>
                  <p className="text-sm font-bold text-foreground">
                    {formatCurrency(receitaAtual)} <span className="text-muted-foreground font-normal">→</span> {formatCurrency(simulacao.receitaTotal)}
                  </p>
                  <p className={`text-[11px] font-medium ${deltaReceita < 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                    {deltaReceita >= 0 ? '+' : ''}{formatCurrency(deltaReceita)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Resultado do mix</p>
                  <p className="text-sm font-bold text-foreground">
                    {formatCurrency(lucroAtual)} <span className="text-muted-foreground font-normal">→</span> {formatCurrency(simulacao.lucroLiquidoTotal)}
                  </p>
                  <p className={`text-[11px] font-medium ${deltaLucro < 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                    {deltaLucro >= 0 ? '+' : ''}{formatCurrency(deltaLucro)}
                    {lucroAtual !== 0 && ` (${deltaLucroPercent >= 0 ? '+' : ''}${deltaLucroPercent.toFixed(0)}%)`}
                  </p>
                </div>
              </div>
              {deltaLucro < 0 && (
                <p className="text-[11px] text-amber-800 mt-2 leading-relaxed">
                  Esta projeção considera o volume parado. O volume de fato reage ao preço — mas,
                  como a conta acima mostra, quase nunca o suficiente para repor a margem perdida.
                  Se a queda parecer grande demais, suba a margem da faixa da classe A ou mande só
                  parte dos produtos para ela.
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1">
            <button
              type="button"
              disabled={mudariam === 0}
              onClick={() => {
                if (!confirmando) {
                  setConfirmando(true);
                  window.setTimeout(() => setConfirmando(false), 3500);
                  return;
                }
                setConfirmando(false);
                onAplicar(mapaEfetivo);
              }}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                confirmando ? 'bg-amber-500 text-white' : 'bg-primary text-primary-foreground hover:bg-primary/90'
              }`}
            >
              {confirmando ? 'Confirmar?' : 'Aplicar estratégias por classe'}
            </button>
            <span className="text-[11px] text-muted-foreground">
              {mudariam === 0
                ? 'Nenhum produto mudaria de estratégia com este mapeamento.'
                : `${mudariam} ${mudariam === 1 ? 'produto muda' : 'produtos mudam'} de estratégia. Os preços são recalculados na hora — dá para desfazer trocando a faixa de volta.`}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
