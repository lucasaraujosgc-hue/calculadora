import React from 'react';
import {
  CATEGORIAS_LC214,
  GRUPOS_REDUCAO,
  categoriaPorId,
  fatorDoRegime,
} from '../domain/reformaTributaria';

const inputCls = 'w-full px-3 py-2 border border-border rounded-md bg-background text-sm focus:ring-2 focus:ring-primary/50';

/**
 * Escolha do enquadramento do produto ou serviço nas reduções da LC 214/2025,
 * agrupadas pelo tamanho do redutor, com a opção de informar um percentual
 * próprio quando o caso não se encaixa nas hipóteses listadas.
 */
export function SeletorReducaoLC214({
  categoriaId,
  reducaoPersonalizada,
  onCategoriaChange,
  onReducaoChange,
  label = 'Enquadramento do produto ou serviço (LC 214/2025)',
  /** Alíquotas de referência, para mostrar quanto sobra depois do redutor. */
  aliquotaBase,
}: {
  categoriaId: string;
  reducaoPersonalizada: number;
  onCategoriaChange: (id: string) => void;
  onReducaoChange: (v: number) => void;
  label?: string;
  aliquotaBase?: number;
}) {
  const categoria = categoriaPorId(categoriaId);
  const fator = fatorDoRegime(categoria.classificacao, reducaoPersonalizada);

  return (
    <div className="space-y-2">
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
        <select
          value={categoria.id}
          onChange={e => onCategoriaChange(e.target.value)}
          className={inputCls}
        >
          {GRUPOS_REDUCAO.map(grupo => {
            const itens = CATEGORIAS_LC214.filter(c => c.grupo === grupo);
            if (itens.length === 0) return null;
            return (
              <optgroup key={grupo} label={grupo}>
                {itens.map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </optgroup>
            );
          })}
        </select>
        <p className="text-xs text-muted-foreground mt-1">{categoria.descricao}</p>
      </div>

      {categoria.classificacao === 'personalizado' && (
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Redução da alíquota (%)</label>
          <input
            type="number"
            step="0.01"
            min={0}
            max={100}
            value={reducaoPersonalizada}
            onChange={e => onReducaoChange(Number(e.target.value))}
            className={inputCls}
          />
          <p className="text-xs text-muted-foreground mt-1">
            0% mantém a alíquota cheia; 100% zera a alíquota. A redução vale igual para a CBS e para o IBS.
          </p>
        </div>
      )}

      {aliquotaBase !== undefined && (
        <p className="text-xs text-muted-foreground">
          Com este enquadramento, a alíquota sai de {aliquotaBase.toFixed(2)}% para{' '}
          <strong className="text-foreground">{(aliquotaBase * fator).toFixed(2)}%</strong>
          {fator < 1 && fator > 0 && ` (redução de ${((1 - fator) * 100).toFixed(0)}%)`}
          {fator === 0 && ' (não tributado na saída)'}.
        </p>
      )}
    </div>
  );
}

export default SeletorReducaoLC214;
