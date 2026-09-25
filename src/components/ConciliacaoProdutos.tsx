import React, { useCallback, useEffect, useState } from 'react';
import { Link2, Check, AlertCircle, RefreshCw } from 'lucide-react';

/**
 * Amarra os produtos do cadastro aos das notas.
 *
 * Quem é aplicado a partir de uma nota já nasce amarrado. Esta tela é para o
 * catálogo anterior — digitado à mão ou vindo de planilha. Depois de conciliado,
 * renomear o produto deixa de desfazer o vínculo, e o histórico de custo, preço
 * e reação ao preço passa a encontrar o produto certo.
 *
 * O sistema propõe, o usuário confirma. Um casamento errado joga o histórico de
 * um produto no preço de outro, então nada é aplicado sozinho.
 */

interface Sugestao {
  produtoId: string;
  nomeProduto: string;
  chaveProduto: string | null;
  descricaoFiscal: string | null;
  confianca: number;
  motivo: string;
}

interface ProdutoFiscal {
  chaveProduto: string;
  descricao: string;
  ean?: string;
}

const forcaDaProposta = (c: number) =>
  c >= 100 ? { texto: 'Nome igual', cor: 'bg-emerald-100 text-emerald-800 border-emerald-200' }
  : c >= 70 ? { texto: 'Provável', cor: 'bg-sky-100 text-sky-800 border-sky-200' }
  : { texto: 'Possível', cor: 'bg-amber-100 text-amber-900 border-amber-200' };

export default function ConciliacaoProdutos({ aoConciliar }: { aoConciliar?: () => void }) {
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [disponiveis, setDisponiveis] = useState<ProdutoFiscal[]>([]);
  const [totais, setTotais] = useState({ cadastro: 0, conciliados: 0 });
  const [escolhas, setEscolhas] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // O spinner só é ligado em recargas explícitas. Na montagem o estado já nasce
  // carregando, e mexer nele aqui seria um setState síncrono dentro do efeito.
  const carregar = useCallback(async (mostrarSpinner = false) => {
    if (mostrarSpinner) setCarregando(true);
    try {
      const res = await fetch('/api/fiscal/conciliacao');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSugestoes(data.sugestoes || []);
      setDisponiveis(data.disponiveis || []);
      setTotais({ cadastro: data.totalCadastro || 0, conciliados: data.totalConciliados || 0 });
      // As propostas entram pré-selecionadas; desmarcar é um clique no seletor.
      const iniciais: Record<string, string> = {};
      (data.sugestoes || []).forEach((s: Sugestao) => {
        if (s.chaveProduto) iniciais[s.produtoId] = s.chaveProduto;
      });
      setEscolhas(iniciais);
    } catch {
      setErro('Não foi possível carregar a conciliação.');
    } finally {
      setCarregando(false);
    }
  }, []);

  // Busca na montagem. O setState acontece depois do await, não no corpo do
  // efeito, mas o analisador não consegue atravessar a função assíncrona — é o
  // mesmo aviso que a regra dá em toda busca de dados deste projeto.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void carregar(); }, [carregar]);

  const confirmar = async () => {
    const vinculos = Object.entries(escolhas)
      .filter(([, chave]) => !!chave)
      .map(([produtoId, chaveProduto]) => ({ produtoId, chaveProduto }));
    if (vinculos.length === 0) return;

    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch('/api/fiscal/conciliacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vinculos }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar.');

      const recusados = (data.recusados || []).length;
      setAviso(
        `${data.vinculados} ${data.vinculados === 1 ? 'produto vinculado' : 'produtos vinculados'}.`
        + (recusados > 0 ? ` ${recusados} não foi possível — o produto das notas já tem dono.` : '')
      );
      await carregar();
      aoConciliar?.();
    } catch (e: any) {
      setErro(e?.message || 'Erro ao salvar a conciliação.');
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) {
    return <p className="text-sm text-muted-foreground">Carregando a conciliação...</p>;
  }

  const selecionados = Object.values(escolhas).filter(Boolean).length;
  const pendentes = sugestoes.length;

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Link2 className="w-4 h-4 text-primary" /> Ligar o cadastro às notas
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Produtos aplicados a partir de uma nota já ficam ligados sozinhos. Estes aqui foram
          cadastrados antes — ligá-los faz o histórico de custo, preço e reação ao preço encontrar
          o produto certo, e o vínculo passa a sobreviver a renomeações.
        </p>
        <p className="text-[11px] text-muted-foreground mt-1">
          {totais.conciliados} de {totais.cadastro} {totais.cadastro === 1 ? 'produto ligado' : 'produtos ligados'}.
        </p>
      </div>

      {pendentes === 0 ? (
        <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" /> Todo o cadastro já está ligado às notas.
        </p>
      ) : (
        <>
          <ul className="space-y-1.5">
            {sugestoes.map(s => {
              const escolhido = escolhas[s.produtoId] || '';
              const forca = forcaDaProposta(s.confianca);
              return (
                <li key={s.produtoId} className="p-2.5 rounded-lg border border-border bg-background">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate" title={s.nomeProduto}>
                        {s.nomeProduto}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{s.motivo}</p>
                    </div>

                    {s.chaveProduto && (
                      <span className={`shrink-0 self-start sm:self-auto inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${forca.cor}`}>
                        {forca.texto}
                      </span>
                    )}

                    <select
                      value={escolhido}
                      onChange={e => setEscolhas(prev => ({ ...prev, [s.produtoId]: e.target.value }))}
                      className="shrink-0 w-full sm:w-64 px-2 py-1.5 border border-border rounded bg-background text-xs focus:ring-2 focus:ring-primary/50"
                    >
                      <option value="">Não ligar agora</option>
                      {/* A proposta entra mesmo que a chave não esteja em `disponiveis`
                          por já ter sido escolhida para outra linha nesta mesma tela. */}
                      {s.chaveProduto && !disponiveis.some(d => d.chaveProduto === s.chaveProduto) && (
                        <option value={s.chaveProduto}>{s.descricaoFiscal}</option>
                      )}
                      {disponiveis.map(d => (
                        <option key={d.chaveProduto} value={d.chaveProduto}>{d.descricao}</option>
                      ))}
                    </select>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <button
              type="button"
              onClick={confirmar}
              disabled={selecionados === 0 || salvando}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {salvando ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {salvando ? 'Ligando...' : `Confirmar ${selecionados} ${selecionados === 1 ? 'vínculo' : 'vínculos'}`}
            </button>
            <span className="text-[11px] text-muted-foreground">
              Nenhum valor é alterado agora — o vínculo só diz qual produto das notas é qual do cadastro.
            </span>
          </div>
        </>
      )}

      {aviso && (
        <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md p-2.5">{aviso}</p>
      )}
      {erro && (
        <p className="text-xs text-red-600 flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" /> {erro}
        </p>
      )}
    </div>
  );
}
