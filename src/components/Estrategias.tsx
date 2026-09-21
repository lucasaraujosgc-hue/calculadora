import React, { useState } from 'react';
import { Plus, Pencil, Trash2, Check, X, AlertCircle, Target } from 'lucide-react';
import { useAppContext, EstrategiaItem, ProdutoItem } from '../context/AppContext';

/**
 * Estratégias de margem: poucas faixas nomeadas no lugar de uma margem solta
 * por produto.
 *
 * A ideia é trocar a pergunta difícil — "que margem este parafuso leva?" — pela
 * fácil: "este é produto de atração ou de margem?". A política fica em um lugar
 * só, e mudar a margem da faixa reprecifica todo mundo que a segue.
 */

/**
 * Tailwind não monta classe por concatenação (o purge não enxergaria
 * `bg-${cor}-100`), então as cores possíveis ficam escritas aqui.
 */
const CORES: Record<string, { selo: string; ponto: string }> = {
  sky: { selo: 'bg-sky-100 text-sky-800 border-sky-200', ponto: 'bg-sky-500' },
  slate: { selo: 'bg-slate-100 text-slate-700 border-slate-200', ponto: 'bg-slate-400' },
  emerald: { selo: 'bg-emerald-100 text-emerald-800 border-emerald-200', ponto: 'bg-emerald-500' },
  amber: { selo: 'bg-amber-100 text-amber-800 border-amber-200', ponto: 'bg-amber-500' },
  violet: { selo: 'bg-violet-100 text-violet-800 border-violet-200', ponto: 'bg-violet-500' },
  rose: { selo: 'bg-rose-100 text-rose-800 border-rose-200', ponto: 'bg-rose-500' },
};

export const coresDaEstrategia = (cor?: string) => CORES[cor || 'slate'] || CORES.slate;

/** Selo compacto da faixa, para a tabela do Mix. */
export function SeloEstrategia({ estrategia }: { estrategia: EstrategiaItem | null }) {
  if (!estrategia) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-dashed border-border text-muted-foreground">
        Personalizado
      </span>
    );
  }
  const c = coresDaEstrategia(estrategia.cor);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${c.selo}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.ponto}`} />
      {estrategia.nome}
    </span>
  );
}

/**
 * Seletor de faixa de um produto.
 *
 * Ao sair de uma faixa para "Personalizado", a margem dela é copiada para o
 * produto: o preço não dá salto no instante em que a pessoa destrava o campo.
 */
export function SeletorEstrategia({
  produto,
  onChange,
  compacto = false,
}: {
  produto: ProdutoItem;
  onChange: (updates: Partial<ProdutoItem>) => void;
  compacto?: boolean;
}) {
  const { estrategias } = useAppContext();
  const atual = estrategias.find(e => e.id === produto.estrategiaId) || null;

  return (
    <select
      value={atual?.id ?? ''}
      onChange={(e) => {
        const id = e.target.value;
        if (!id) {
          onChange({ estrategiaId: null, margem: atual ? atual.margem : (produto.margem || 0) });
        } else {
          onChange({ estrategiaId: id });
        }
      }}
      title={atual ? `${atual.nome} — margem alvo de ${atual.margem}%` : 'Margem definida só para este produto'}
      className={`border rounded bg-background focus:ring-2 focus:ring-primary/50 ${
        compacto ? 'w-full max-w-[130px] px-1.5 py-1 text-xs' : 'w-full px-3 py-2 text-sm'
      } ${atual ? 'border-border text-foreground' : 'border-dashed border-border text-muted-foreground'}`}
    >
      {estrategias.map(e => (
        <option key={e.id} value={e.id}>{e.nome} · {e.margem}%</option>
      ))}
      <option value="">Personalizado</option>
    </select>
  );
}

/** Cadastro das faixas: nome, margem alvo, criar e excluir. */
export default function EstrategiasManager({ compacto = false }: { compacto?: boolean }) {
  const { estrategias, produtos, addEstrategia, updateEstrategia, removeEstrategia } = useAppContext();

  const [novoNome, setNovoNome] = useState('');
  const [novaMargem, setNovaMargem] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nomeEditado, setNomeEditado] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);

  const executar = async (acao: () => Promise<void>) => {
    setErro(null);
    try { await acao(); } catch (e: any) { setErro(e?.message || 'Não foi possível concluir a ação.'); }
  };

  const quantosSeguem = (id: string) => produtos.filter(p => p.estrategiaId === id).length;

  const excluir = (id: string) => {
    if (confirmandoId !== id) {
      setConfirmandoId(id);
      window.setTimeout(() => setConfirmandoId(a => (a === id ? null : a)), 3500);
      return;
    }
    setConfirmandoId(null);
    void executar(() => removeEstrategia(id));
  };

  return (
    <div className={compacto ? '' : 'bg-card border border-border rounded-xl p-4 sm:p-5'}>
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Target className="w-4 h-4 text-primary" /> Estratégias de margem
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Nem todo produto merece a mesma margem. O item que o cliente compara de loja em loja
          puxa gente para dentro; o que ninguém confere é onde você ganha. Defina as faixas uma vez
          e diga, por produto, a qual delas ele pertence.
        </p>
      </div>

      <div className="flex items-center gap-2 px-3 mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span className="w-2 shrink-0" />
        <span className="flex-1 min-w-0">Faixa</span>
        <span className="shrink-0 w-[72px] text-center">Margem</span>
        <span className="shrink-0 w-[72px] text-center" title="A menor margem que você aceita nesta faixa">Piso</span>
        <span className="shrink-0 w-[62px]" />
      </div>

      <ul className="space-y-1.5 mb-3">
        {estrategias.map(e => {
          const c = coresDaEstrategia(e.cor);
          const seguidores = quantosSeguem(e.id);
          return (
            <li key={e.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background">
              <span className={`w-2 h-2 rounded-full shrink-0 ${c.ponto}`} />

              {editandoId === e.id ? (
                <>
                  <input
                    autoFocus
                    value={nomeEditado}
                    maxLength={30}
                    onChange={ev => setNomeEditado(ev.target.value)}
                    onKeyDown={ev => {
                      if (ev.key === 'Enter') void executar(async () => {
                        await updateEstrategia(e.id, { nome: nomeEditado });
                        setEditandoId(null);
                      });
                      if (ev.key === 'Escape') setEditandoId(null);
                    }}
                    className="flex-1 min-w-0 px-2 py-1 border border-border rounded bg-background text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => void executar(async () => {
                      await updateEstrategia(e.id, { nome: nomeEditado });
                      setEditandoId(null);
                    })}
                    className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditandoId(null)}
                    className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded border border-border bg-background hover:bg-muted/50"
                  >
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground" title={e.nome}>{e.nome}</span>
                    <span className="block text-[10px] text-muted-foreground">
                      {seguidores === 0 ? 'nenhum produto' : seguidores === 1 ? '1 produto' : `${seguidores} produtos`}
                    </span>
                  </div>

                  <div className="relative shrink-0 w-[72px]">
                    <input
                      type="number"
                      value={e.margem}
                      min={0}
                      max={99}
                      onChange={ev => void executar(() => updateEstrategia(e.id, { margem: Number(ev.target.value) }))}
                      title="Margem alvo desta faixa — é ela que forma o preço sugerido"
                      className="w-full pl-2 pr-5 py-1 border border-border rounded bg-muted/20 text-sm font-semibold text-center focus:ring-2 focus:ring-primary/50"
                    />
                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">%</span>
                  </div>

                  <div className="relative shrink-0 w-[72px]">
                    <input
                      type="number"
                      value={e.piso ?? 0}
                      min={0}
                      max={e.margem}
                      onChange={ev => void executar(() => updateEstrategia(e.id, { piso: Number(ev.target.value) }))}
                      title="Piso: a menor margem que você aceita nesta faixa. Não muda o preço sugerido — avisa quando um preço digitado à mão fura o limite. 0 = sem piso."
                      className="w-full pl-2 pr-5 py-1 border border-dashed border-border rounded bg-background text-sm text-center text-muted-foreground focus:ring-2 focus:ring-primary/50"
                    />
                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">%</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => { setEditandoId(e.id); setNomeEditado(e.nome); setErro(null); }}
                    title="Renomear"
                    className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded border border-border bg-background hover:bg-muted/50"
                  >
                    <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <button
                    type="button"
                    onClick={() => excluir(e.id)}
                    disabled={estrategias.length <= 1}
                    title={
                      estrategias.length <= 1
                        ? 'Você precisa manter ao menos uma estratégia'
                        : seguidores > 0
                          ? `${seguidores} produto(s) passam a Personalizado com ${e.margem}% — o preço deles não muda`
                          : 'Excluir estratégia'
                    }
                    className={`shrink-0 inline-flex items-center gap-1 h-7 rounded border transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                      confirmandoId === e.id
                        ? 'px-2 border-amber-400 bg-amber-500 text-white text-xs font-semibold'
                        : 'w-7 justify-center border-border bg-background hover:bg-red-50 hover:border-red-200'
                    }`}
                  >
                    {confirmandoId === e.id ? 'Confirmar?' : <Trash2 className="w-3.5 h-3.5 text-red-500" />}
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex gap-2">
        <input
          value={novoNome}
          maxLength={30}
          onChange={e => setNovoNome(e.target.value)}
          placeholder="Ex: Liquidação, Encomenda"
          className="flex-1 min-w-0 px-3 py-2 border border-border rounded-lg bg-background text-sm focus:ring-2 focus:ring-primary/50"
        />
        <div className="relative shrink-0 w-[84px]">
          <input
            type="number"
            value={novaMargem}
            onChange={e => setNovaMargem(e.target.value)}
            placeholder="25"
            title="Margem alvo da nova faixa (o piso começa em 0 e pode ser ajustado depois)"
            className="w-full pl-3 pr-6 py-2 border border-border rounded-lg bg-background text-sm focus:ring-2 focus:ring-primary/50"
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">%</span>
        </div>
        <button
          type="button"
          onClick={() => void executar(async () => {
            await addEstrategia(novoNome, Number(novaMargem));
            setNovoNome(''); setNovaMargem('');
          })}
          disabled={!novoNome.trim() || novaMargem === ''}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" /> Criar
        </button>
      </div>

      {erro && (
        <p className="mt-2 text-xs text-red-600 flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" /> {erro}
        </p>
      )}
    </div>
  );
}
