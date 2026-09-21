import React from 'react';
import { TrendingDown, Info } from 'lucide-react';
import {
  projetarVolume,
  ROTULO_CONFIANCA,
  type ResultadoElasticidade,
} from '../domain/elasticidade';

/**
 * Leitura da elasticidade-preço de um produto, a partir do próprio histórico.
 *
 * O que importa aqui não é o coeficiente — é a frase que ele permite dizer. O
 * lojista não decide preço com "−1,84"; decide com "quando subiu 10%, o volume
 * caiu 17%". E quando não há base para dizer isso, a tela diz que não há, em vez
 * de mostrar um número que parece preciso e não é.
 */

const CORES_CONFIANCA: Record<string, string> = {
  insuficiente: 'bg-muted/40 border-border text-muted-foreground',
  fraca: 'bg-amber-50 border-amber-200 text-amber-900',
  razoavel: 'bg-sky-50 border-sky-200 text-sky-900',
  boa: 'bg-emerald-50 border-emerald-200 text-emerald-900',
};

/** Variações que a tela projeta, por serem as conversas reais de balcão. */
const CENARIOS = [-10, -5, 5, 10];

const pct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

export default function PainelElasticidade({ elasticidade }: { elasticidade?: ResultadoElasticidade }) {
  if (!elasticidade) return null;

  const { confianca, motivo, classificacao, pontos, r2, variacaoPrecoPercent } = elasticidade;
  const medivel = elasticidade.elasticidade !== null && confianca !== 'insuficiente';

  return (
    <div className={`rounded-lg border p-3 mb-3 ${CORES_CONFIANCA[confianca]}`}>
      <div className="flex items-start gap-2">
        <TrendingDown className="w-4 h-4 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold">
            Reação do volume ao preço
            <span className="ml-2 font-semibold opacity-80">{ROTULO_CONFIANCA[confianca]}</span>
          </p>

          {medivel ? (
            <>
              <p className="text-xs mt-1 leading-relaxed">
                Neste produto, cada <strong>1% de aumento no preço</strong> veio acompanhado de{' '}
                <strong>{Math.abs(elasticidade.elasticidade!).toFixed(2)}% de queda no volume</strong>.
                {' '}{motivo}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2.5">
                {CENARIOS.map(variacao => {
                  const efeito = projetarVolume(elasticidade, variacao);
                  if (efeito === null) return null;
                  return (
                    <div key={variacao} className="rounded-md bg-background/70 border border-border px-2 py-1.5">
                      <p className="text-[10px] opacity-70">Preço {pct(variacao)}</p>
                      <p className="text-sm font-bold">{pct(efeito)}</p>
                      <p className="text-[10px] opacity-70">no volume</p>
                    </div>
                  );
                })}
              </div>

              <p className="text-[10px] mt-2 opacity-80 leading-relaxed">
                Estimado de {pontos} {pontos === 1 ? 'mês' : 'meses'} com venda, numa faixa de preço que variou{' '}
                {variacaoPrecoPercent.toFixed(0)}%{r2 !== null && ` · o preço explica ${(r2 * 100).toFixed(0)}% do movimento do volume`}.
                {confianca === 'fraca' && ' Com esse grau de explicação, trate como indício, não como previsão.'}
                {classificacao === 'elastico'
                  ? ' Vale para variações parecidas com as que a empresa já praticou — fora dessa faixa é extrapolação.'
                  : ''}
              </p>
            </>
          ) : (
            <p className="text-xs mt-1 leading-relaxed flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
              <span>{motivo}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
