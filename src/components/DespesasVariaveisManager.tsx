import React, { useState } from 'react';
import { Plus, Pencil, Trash2, Check, X, AlertCircle } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

/**
 * Cadastro das despesas variáveis do usuário.
 *
 * No lugar do campo único "Outros", cada empresa monta a própria lista — frete,
 * embalagem, taxa de marketplace, royalties. A lista é individual: quem cria
 * uma despesa aqui só a vê na própria conta.
 *
 * Renomear preserva os percentuais já preenchidos nos produtos (o vínculo é
 * pelo id, não pelo nome). Excluir tira a despesa do preço imediatamente, mas
 * não apaga os percentuais dos produtos.
 */
export default function DespesasVariaveisManager({ compacto = false }: { compacto?: boolean }) {
  const { despesasVariaveis, addDespesaVariavel, renameDespesaVariavel, removeDespesaVariavel } = useAppContext();

  const [novoNome, setNovoNome] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nomeEditado, setNomeEditado] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);

  const executar = async (acao: () => Promise<void>) => {
    setErro(null);
    try {
      await acao();
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível concluir a ação.');
    }
  };

  const criar = () => {
    if (!novoNome.trim()) return;
    void executar(async () => {
      await addDespesaVariavel(novoNome);
      setNovoNome('');
    });
  };

  const salvarNome = (id: string) => {
    void executar(async () => {
      await renameDespesaVariavel(id, nomeEditado);
      setEditandoId(null);
      setNomeEditado('');
    });
  };

  const excluir = (id: string) => {
    if (confirmandoId !== id) {
      setConfirmandoId(id);
      window.setTimeout(() => setConfirmandoId(atual => (atual === id ? null : atual)), 3500);
      return;
    }
    setConfirmandoId(null);
    void executar(() => removeDespesaVariavel(id));
  };

  return (
    <div className={compacto ? '' : 'bg-card border border-border rounded-xl p-4 sm:p-5'}>
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-foreground">Minhas despesas variáveis</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Tudo que sai em cima de cada venda, além de imposto e taxa de cartão. Elas viram colunas
          no Mix e entram no cálculo do preço.
        </p>
      </div>

      {despesasVariaveis.length > 0 && (
        <ul className="space-y-1.5 mb-3">
          {despesasVariaveis.map(d => (
            <li
              key={d.id}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background"
            >
              {editandoId === d.id ? (
                <>
                  <input
                    autoFocus
                    value={nomeEditado}
                    maxLength={40}
                    onChange={e => setNomeEditado(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') salvarNome(d.id);
                      if (e.key === 'Escape') setEditandoId(null);
                    }}
                    className="flex-1 min-w-0 px-2 py-1 border border-border rounded bg-background text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => salvarNome(d.id)}
                    title="Salvar nome"
                    className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditandoId(null)}
                    title="Cancelar"
                    className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded border border-border bg-background hover:bg-muted/50"
                  >
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 min-w-0 truncate text-sm font-medium text-foreground" title={d.nome}>
                    {d.nome}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditandoId(d.id);
                      setNomeEditado(d.nome);
                      setErro(null);
                    }}
                    title="Renomear (os percentuais já preenchidos são mantidos)"
                    className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded border border-border bg-background hover:bg-muted/50"
                  >
                    <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <button
                    type="button"
                    onClick={() => excluir(d.id)}
                    title="Excluir despesa"
                    className={`shrink-0 inline-flex items-center gap-1 h-7 rounded border transition-colors ${
                      confirmandoId === d.id
                        ? 'px-2 border-amber-400 bg-amber-500 text-white text-xs font-semibold'
                        : 'w-7 justify-center border-border bg-background hover:bg-red-50 hover:border-red-200'
                    }`}
                  >
                    {confirmandoId === d.id ? 'Confirmar?' : <Trash2 className="w-3.5 h-3.5 text-red-500" />}
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <input
          value={novoNome}
          maxLength={40}
          onChange={e => setNovoNome(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && criar()}
          placeholder="Ex: Frete, Embalagem, Taxa do marketplace"
          className="flex-1 min-w-0 px-3 py-2 border border-border rounded-lg bg-background text-sm focus:ring-2 focus:ring-primary/50"
        />
        <button
          type="button"
          onClick={criar}
          disabled={!novoNome.trim()}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" /> Adicionar
        </button>
      </div>

      {erro && (
        <p className="mt-2 text-xs text-red-600 flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" /> {erro}
        </p>
      )}

      {despesasVariaveis.length === 0 && !erro && (
        <p className="mt-2 text-xs text-muted-foreground">
          Sem despesas cadastradas — só imposto, taxa de cartão e comissão entram no preço.
        </p>
      )}
    </div>
  );
}
