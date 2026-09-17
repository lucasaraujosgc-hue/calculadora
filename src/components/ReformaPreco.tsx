import React, { useCallback, useMemo, useState } from 'react';
import { Scale, Info } from 'lucide-react';
import {
  ALIQUOTA_REF_CBS,
  ALIQUOTA_REF_IBS,
  ANEXOS_SIMPLES,
  CRONOGRAMA,
  FAIXAS_SIMPLES,
  PRESETS_REGIME,
  REGIMES_DIFERENCIADOS,
  aliquotasDoAno,
  parcelaPisCofins,
  projetarPrecoReforma,
  type ClassificacaoReforma,
  type ProjecaoPreco,
  type RegimeReforma,
} from '../domain/reformaTributaria';

const STORAGE_KEY = 'vc_reforma_preco';

export interface ReformaPrecoConfig {
  /** A projeção está ligada nas telas de preço? */
  ativo: boolean;
  ano: number;
  regime: RegimeReforma;
  anexo: string;
  faixaIndex: number;
  classificacao: ClassificacaoReforma;
  refCbs: number;
  refIbs: number;
  /** % do CMV que passa a gerar crédito de CBS que hoje não existe. */
  percCmvComCredito: number;
}

export const CONFIG_REFORMA_PADRAO: ReformaPrecoConfig = {
  ativo: false,
  ano: 2027,
  regime: 'presumido',
  anexo: 'Anexo I',
  faixaIndex: 0,
  classificacao: 'padrao',
  refCbs: ALIQUOTA_REF_CBS,
  refIbs: ALIQUOTA_REF_IBS,
  percCmvComCredito: PRESETS_REGIME.presumido.creditoPadrao,
};

/** Anos em que faz sentido projetar preço — 2026 é ano-teste e não muda nada. */
const ANOS_PROJETAVEIS = CRONOGRAMA.filter(f => f.ano >= 2027).map(f => f.ano);

function ler(): ReformaPrecoConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return CONFIG_REFORMA_PADRAO;
    return { ...CONFIG_REFORMA_PADRAO, ...JSON.parse(raw) };
  } catch {
    return CONFIG_REFORMA_PADRAO;
  }
}

/**
 * Configuração da projeção da reforma, compartilhada entre a Formação de Preço
 * e os Preços em Lote e guardada no navegador.
 */
export function useReformaPrecoConfig() {
  const [config, setConfigState] = useState<ReformaPrecoConfig>(ler);

  const setConfig = useCallback((patch: Partial<ReformaPrecoConfig>) => {
    setConfigState(prev => {
      const proximo = { ...prev, ...patch };
      // Trocar de regime traz de volta o crédito padrão daquele regime.
      if (patch.regime && patch.regime !== prev.regime) {
        proximo.percCmvComCredito = PRESETS_REGIME[patch.regime].creditoPadrao;
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(proximo));
      } catch {
        // Navegação anônima ou storage bloqueado: segue só em memória.
      }
      return proximo;
    });
  }, []);

  return { config, setConfig };
}

export interface ParametrosProduto {
  cmv: number;
  custoFixoUnitario: number;
  impostoPercent: number;
  despesasPercent: number;
  margemPercent: number;
  precoAtual: number;
}

export interface MotorReforma {
  /** Alíquota por fora do ano (CBS, mais IBS a partir de 2029). */
  aliquotaPorFora: number;
  aliquotaCbs: number;
  aliquotaIbs: number;
  fase: ReturnType<typeof aliquotasDoAno>;
  preset: (typeof PRESETS_REGIME)[RegimeReforma];
  /** Neste regime o preço muda no ano escolhido? */
  precoMuda: boolean;
  projetar: (p: ParametrosProduto) => ProjecaoPreco;
}

/**
 * Monta o motor de projeção a partir da configuração escolhida.
 *
 * Em 2027 e 2028 só a CBS entra: apenas a parcela de PIS/COFINS sai de dentro
 * do preço. De 2029 em diante o IBS vai substituindo ICMS e ISS, então a
 * parcela que sai de dentro cresce na mesma proporção, até que em 2033 todo o
 * imposto passa a ser cobrado por fora.
 */
export function useMotorReforma(config: ReformaPrecoConfig): MotorReforma {
  return useMemo(() => {
    const fase = aliquotasDoAno(config.ano, config.refCbs, config.refIbs);
    const preset = PRESETS_REGIME[config.regime];
    const aliquotaPorFora = fase.cbs + fase.ibs;

    const projetar = (p: ParametrosProduto) => {
      const pisCofins = parcelaPisCofins(config.regime, p.impostoPercent, config.anexo, config.faixaIndex);
      // O que ainda é ICMS/ISS vai saindo de dentro do preço conforme o IBS entra.
      const icmsIss = Math.max(0, p.impostoPercent - pisCofins);
      const saiPorDentro = preset.precoMuda
        ? pisCofins + icmsIss * (1 - fase.fatorIcmsIss)
        : 0;

      return projetarPrecoReforma({
        cmv: p.cmv,
        custoFixoUnitario: p.custoFixoUnitario,
        impostoPercent: p.impostoPercent,
        pisCofinsPercent: saiPorDentro,
        despesasPercent: p.despesasPercent,
        margemPercent: p.margemPercent,
        aliquotaCbs: preset.precoMuda ? aliquotaPorFora : 0,
        classificacao: config.classificacao,
        percCmvComCredito: preset.precoMuda ? config.percCmvComCredito : 0,
        precoAtual: p.precoAtual,
      });
    };

    return {
      aliquotaPorFora,
      aliquotaCbs: fase.cbs,
      aliquotaIbs: fase.ibs,
      fase,
      preset,
      precoMuda: preset.precoMuda,
      projetar,
    };
  }, [config]);
}

const inputCls = 'w-full px-3 py-2 border border-border rounded-md bg-background text-sm focus:ring-2 focus:ring-primary/50';

/**
 * Painel de configuração da projeção — o mesmo na Formação de Preço e nos
 * Preços em Lote, para que os dois mostrem o preço da reforma do mesmo jeito.
 */
export function PainelReformaPreco({
  config,
  setConfig,
  motor,
}: {
  config: ReformaPrecoConfig;
  setConfig: (patch: Partial<ReformaPrecoConfig>) => void;
  motor: MotorReforma;
}) {
  return (
    <div className="bg-card border border-sky-300 rounded-xl shadow-sm">
      <button
        type="button"
        onClick={() => setConfig({ ativo: !config.ativo })}
        className="w-full flex items-center justify-between gap-3 p-4 text-left"
      >
        <span className="flex items-center gap-2">
          <Scale className="w-5 h-5 text-sky-600 shrink-0" />
          <span className="text-sm font-medium text-foreground">Mostrar o preço com a Reforma Tributária</span>
        </span>
        <span
          className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${config.ativo ? 'bg-primary' : 'bg-muted-foreground/30'}`}
          aria-hidden
        >
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${config.ativo ? 'translate-x-5' : ''}`} />
        </span>
      </button>

      {config.ativo && (
        <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Ano da projeção</label>
            <div className="grid grid-cols-4 gap-1.5">
              {ANOS_PROJETAVEIS.map(ano => (
                <button
                  key={ano}
                  type="button"
                  onClick={() => setConfig({ ano })}
                  className={`py-1.5 px-1 rounded-md border text-xs font-medium ${config.ano === ano ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-foreground border-border hover:bg-muted'}`}
                >
                  {ano}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Regime tributário da empresa</label>
            <select
              value={config.regime}
              onChange={e => setConfig({ regime: e.target.value as RegimeReforma })}
              className={inputCls}
            >
              {(Object.keys(PRESETS_REGIME) as RegimeReforma[]).map(r => (
                <option key={r} value={r}>{PRESETS_REGIME[r].label}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">{motor.preset.descricao}</p>
          </div>

          {motor.preset.usaTabelaSimples && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Anexo</label>
                <select value={config.anexo} onChange={e => setConfig({ anexo: e.target.value })} className={inputCls}>
                  {ANEXOS_SIMPLES.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Faixa do RBT12</label>
                <select
                  value={config.faixaIndex}
                  onChange={e => setConfig({ faixaIndex: Number(e.target.value) })}
                  className={inputCls}
                >
                  {FAIXAS_SIMPLES.map((f, i) => <option key={f} value={i}>{f}</option>)}
                </select>
              </div>
              <p className="col-span-2 text-xs text-muted-foreground">
                Anexo e faixa dizem quanto do seu DAS é PIS/COFINS hoje — é essa fatia que vira CBS.
              </p>
            </div>
          )}

          {motor.precoMuda && (
            <>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Regime do produto na reforma</label>
                <select
                  value={config.classificacao}
                  onChange={e => setConfig({ classificacao: e.target.value as ClassificacaoReforma })}
                  className={inputCls}
                >
                  {(Object.keys(REGIMES_DIFERENCIADOS) as ClassificacaoReforma[]).map(c => (
                    <option key={c} value={c}>{REGIMES_DIFERENCIADOS[c].label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Quanto do CMV vai gerar crédito de CBS que hoje você não aproveita (%)
                </label>
                <input
                  type="number"
                  value={config.percCmvComCredito}
                  onChange={e => setConfig({ percCmvComCredito: Number(e.target.value) })}
                  className={inputCls}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  100% se todo o seu custo vem de fornecedores do regime regular. Use 0% para compras de MEI, de optantes pelo
                  Simples dentro do DAS ou de fora do país.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">CBS de referência (%)</label>
                  <input type="number" step="0.01" value={config.refCbs} onChange={e => setConfig({ refCbs: Number(e.target.value) })} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">IBS de referência (%)</label>
                  <input type="number" step="0.01" value={config.refIbs} onChange={e => setConfig({ refIbs: Number(e.target.value) })} className={inputCls} />
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 bg-sky-50 border border-sky-200 rounded-md text-xs text-sky-900">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Em {config.ano}, {motor.aliquotaIbs > 0.1
                    ? <>CBS de {motor.aliquotaCbs.toFixed(2)}% e IBS de {motor.aliquotaIbs.toFixed(2)}% são somados por fora do preço</>
                    : <>a CBS de {motor.aliquotaCbs.toFixed(2)}% é somada por fora do preço</>}
                  {motor.fase.fatorIcmsIss > 0 && <> e o ICMS/ISS continua por dentro, a {(motor.fase.fatorIcmsIss * 100).toFixed(0)}% da alíquota de hoje</>}.
                  Entenda a conta na aba Reforma Tributária.
                </span>
              </div>
            </>
          )}

          {!motor.precoMuda && (
            <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-900">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Neste regime o preço não muda com a reforma — a guia continua com o mesmo valor, só troca o nome da parcela de
                PIS/COFINS para CBS. Se você vende para outras empresas, vale simular o Simples com a CBS por fora do DAS.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Selo compacto com o preço projetado, para usar em tabelas e listas. */
export function SeloPrecoReforma({
  projecao,
  precoMuda,
  formatar,
  compacto,
}: {
  projecao: ProjecaoPreco;
  precoMuda: boolean;
  formatar: (v: number) => string;
  compacto?: boolean;
}) {
  if (!precoMuda) {
    return (
      <div className="flex flex-col items-center justify-center">
        <span className={`font-bold text-muted-foreground ${compacto ? 'text-sm' : 'text-base'}`}>sem mudança</span>
        <span className="text-[10px] text-muted-foreground mt-0.5">preço mantido</span>
      </div>
    );
  }

  const v = projecao.variacaoPercent;
  const cor = v > 0.005 ? 'text-red-600' : v < -0.005 ? 'text-emerald-600' : 'text-muted-foreground';

  return (
    <div className="flex flex-col items-center justify-center">
      <span className={`font-bold text-sky-700 ${compacto ? 'text-sm' : 'text-base'}`}>{formatar(projecao.precoMantendoMargem)}</span>
      <span className={`text-[10px] font-medium mt-0.5 ${cor}`}>
        {v > 0 ? '▲' : v < 0 ? '▼' : '='} {Math.abs(v).toFixed(1)}% vs hoje
      </span>
    </div>
  );
}
