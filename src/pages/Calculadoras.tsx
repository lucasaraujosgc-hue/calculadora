import React from 'react';
import { Link } from 'react-router-dom';
import { Calculator, DollarSign, Percent, PieChart, TrendingUp, Tags } from 'lucide-react';

const calculadoras = [
  {
    id: 'custo-fixo',
    title: 'Custo Fixo',
    description: 'Calcule quanto cada produto absorve das despesas da empresa, e adicione seus custos fixos.',
    icon: PieChart,
    color: 'text-indigo-500',
    bg: 'bg-indigo-100',
    path: '/custos-fixos'
  },
  {
    id: 'formacao-preco',
    title: 'Formação de Preço & Ponto de Equilíbrio',
    description: 'Defina o preço de venda ideal considerando custos, despesas e descubra sua meta de vendas.',
    icon: Tags,
    color: 'text-emerald-500',
    bg: 'bg-emerald-100',
    path: '/calculadoras/formacao-preco'
  },
  {
    id: 'simulador-impostos',
    title: 'Simulador de Impostos',
    description: 'Compare a carga tributária entre diferentes regimes (MEI, Simples, Presumido, Real).',
    icon: Percent,
    color: 'text-rose-500',
    bg: 'bg-rose-100',
    path: '/impostos'
  }
];

export default function Calculadoras() {
  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-3xl font-serif text-primary">Calculadoras</h1>
        <p className="text-muted-foreground mt-1 text-sm">Selecione a ferramenta de cálculo que deseja utilizar.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        {calculadoras.map(calc => (
          <Link 
            key={calc.id}
            to={calc.path}
            className="group flex flex-col bg-card border border-border rounded-xl p-6 hover:border-primary/50 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className={`p-3 rounded-lg ${calc.bg} ${calc.color}`}>
                <calc.icon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-medium text-foreground">{calc.title}</h3>
            </div>
            <p className="text-muted-foreground text-sm flex-1 mb-6">
              {calc.description}
            </p>
            <div className="text-primary text-sm font-medium flex items-center group-hover:translate-x-1 transition-transform w-fit">
              Acessar calculadora <span className="ml-1">→</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
