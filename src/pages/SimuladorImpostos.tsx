import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function SimuladorImpostos() {
  const [faturamentoAnual, setFaturamentoAnual] = useState(120000);
  const [regime, setRegime] = useState('simples'); // mei, simples, presumido, real, manual
  const [aliquotaManual, setAliquotaManual] = useState(10);
  
  let impostoPercentual = 0;
  let custoMensal = 0;
  const faturamentoMensal = faturamentoAnual / 12;

  if (regime === 'mei') {
    custoMensal = 75; // Fixo MEI médio
    impostoPercentual = faturamentoMensal > 0 ? (custoMensal / faturamentoMensal) * 100 : 0;
  } else if (regime === 'simples') {
    // Estimativa básica
    impostoPercentual = faturamentoAnual <= 180000 ? 4 : faturamentoAnual <= 360000 ? 7.3 : 9.5;
    custoMensal = faturamentoMensal * (impostoPercentual / 100);
  } else if (regime === 'presumido') {
    impostoPercentual = 14.5; // Estimativa média ISS+Pis/Cofins+IRPJ+CSLL
    custoMensal = faturamentoMensal * (impostoPercentual / 100);
  } else if (regime === 'real') {
    impostoPercentual = 18; // Muito variável
    custoMensal = faturamentoMensal * (impostoPercentual / 100);
  } else {
    impostoPercentual = aliquotaManual;
    custoMensal = faturamentoMensal * (impostoPercentual / 100);
  }

  const chartData = [
    { name: 'Faturamento Mensal', valor: faturamentoMensal, fill: '#10b981' },
    { name: 'Imposto Mensal', valor: custoMensal, fill: '#ef4444' },
    { name: 'Líquido', valor: faturamentoMensal - custoMensal, fill: '#3b82f6' }
  ];

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-3xl font-serif text-primary">Simulador de Impostos</h1>
        <p className="text-muted-foreground mt-1 text-sm">Estime a carga tributária da sua empresa de acordo com o regime de tributação.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-6">
        
        {/* Formulário */}
        <div className="bg-card border border-border p-6 rounded-xl shadow-sm space-y-6">
          
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Faturamento Anual (R$)</label>
            <input type="number" value={faturamentoAnual} onChange={e => setFaturamentoAnual(Number(e.target.value))} className="w-full px-3 py-2 border border-border rounded-md bg-background focus:ring-2 focus:ring-primary/50" />
            <p className="text-xs text-muted-foreground mt-1">Faturamento Mensal Médio: R$ {faturamentoMensal.toFixed(2)}</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Regime Tributário</label>
            <div className="grid grid-cols-2 gap-3">
               <button onClick={() => setRegime('mei')} className={`py-2 px-3 rounded-md border text-sm font-medium ${regime === 'mei' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-foreground border-border hover:bg-muted'}`}>MEI</button>
               <button onClick={() => setRegime('simples')} className={`py-2 px-3 rounded-md border text-sm font-medium ${regime === 'simples' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-foreground border-border hover:bg-muted'}`}>Simples Nacional</button>
               <button onClick={() => setRegime('presumido')} className={`py-2 px-3 rounded-md border text-sm font-medium ${regime === 'presumido' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-foreground border-border hover:bg-muted'}`}>Lucro Presumido</button>
               <button onClick={() => setRegime('real')} className={`py-2 px-3 rounded-md border text-sm font-medium ${regime === 'real' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-foreground border-border hover:bg-muted'}`}>Lucro Real</button>
               <button onClick={() => setRegime('manual')} className={`py-2 px-3 rounded-md border text-sm font-medium col-span-2 ${regime === 'manual' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-foreground border-border hover:bg-muted'}`}>Percentual Manual</button>
            </div>
          </div>

          {regime === 'manual' && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Alíquota (%)</label>
              <input type="number" value={aliquotaManual} onChange={e => setAliquotaManual(Number(e.target.value))} className="w-full px-3 py-2 border border-border rounded-md bg-background focus:ring-2 focus:ring-primary/50" />
            </div>
          )}
          
          {regime === 'mei' && faturamentoAnual > 81000 && (
             <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm">
                Atenção: O faturamento anual máximo do MEI é de R$ 81.000,00. Considere migrar para o Simples Nacional.
             </div>
          )}

        </div>

        {/* Resultados */}
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-primary border border-primary/20 p-5 rounded-xl text-primary-foreground shadow-sm col-span-2">
              <p className="text-sm font-medium opacity-80 mb-1">Imposto Mensal Estimado</p>
              <h3 className="text-4xl font-bold">R$ {custoMensal.toFixed(2)}</h3>
              <p className="text-sm opacity-80 mt-2">Alíquota efetiva de {impostoPercentual.toFixed(2)}% sobre o faturamento.</p>
            </div>
          </div>

          <div className="bg-card border border-border p-6 rounded-xl shadow-sm">
            <h3 className="text-lg font-medium text-primary mb-4">Impacto no Faturamento</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" axisLine={false} tickLine={false} tickFormatter={v => `R$${v/1000}k`} />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={120} />
                  <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
                  <Bar dataKey="valor" radius={[0, 4, 4, 0]} barSize={24}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
