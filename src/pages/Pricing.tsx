import React, { useState } from 'react';
import { Check, Star } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export default function Pricing() {
  const { user } = useAppContext();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handleUpgrade = async (planId: string) => {
    setLoadingPlan(planId);
    try {
      const res = await fetch('/api/checkout/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId })
      });
      const data = await res.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Erro ao iniciar pagamento');
        setLoadingPlan(null);
      }
    } catch (err) {
      console.error(err); alert('Erro de conexão. Tente novamente.');
      setLoadingPlan(null);
    }
  };

  return (
    <div className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center max-w-3xl mx-auto mb-16">
        <h2 className="text-sm font-semibold text-primary uppercase tracking-wide">Preços</h2>
        <p className="mt-2 text-4xl font-serif text-foreground">
          Escolha o plano ideal para você
        </p>
        <p className="mt-4 text-xl text-muted-foreground">
          Pagamento único, sem mensalidades. Libere o acesso vitalício à calculadora.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
        {/* Plano Básico */}
        <div className="bg-card border border-border rounded-2xl shadow-sm p-8 flex flex-col h-full">
          <div className="mb-6">
            <h3 className="text-xl font-bold text-foreground">Básico</h3>
            <p className="text-muted-foreground mt-2">Para quem está começando</p>
            <div className="mt-4 flex items-baseline text-4xl font-extrabold text-foreground">
              R$ 9,49
              <span className="ml-1 text-xl font-medium text-muted-foreground"> / único</span>
            </div>
          </div>
          <ul className="space-y-4 mb-8 flex-1">
            <li className="flex items-start">
              <Check className="h-5 w-5 text-emerald-500 shrink-0 mr-3" />
              <span className="text-foreground">Até 20 produtos cadastrados</span>
            </li>
            <li className="flex items-start opacity-50">
              <Check className="h-5 w-5 text-emerald-500 shrink-0 mr-3" />
              <span className="text-foreground line-through">Importação via Excel</span>
            </li>
            <li className="flex items-start opacity-50">
              <Check className="h-5 w-5 text-emerald-500 shrink-0 mr-3" />
              <span className="text-foreground line-through">Call de consultoria</span>
            </li>
          </ul>
          <button 
            onClick={() => handleUpgrade('basico')}
            disabled={loadingPlan === 'basico' || user?.plan === 'basico' || user?.plan === 'intermediario' || user?.plan === 'ilimitado'}
            className="w-full py-3 px-6 rounded-xl font-medium border-2 border-primary text-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
          >
            {loadingPlan === 'basico' ? 'Aguarde...' : (user?.plan === 'basico' ? 'Seu Plano Atual' : 'Assinar Básico')}
          </button>
        </div>

        {/* Plano Intermediário */}
        <div className="bg-primary/5 border-2 border-primary rounded-2xl shadow-md p-8 flex flex-col h-full relative transform md:-translate-y-4">
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <span className="bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wide py-1 px-4 rounded-full flex items-center gap-1 shadow-sm">
              <Star className="w-3 h-3 fill-current" />
              Mais Popular
            </span>
          </div>
          <div className="mb-6">
            <h3 className="text-xl font-bold text-foreground">Intermediário</h3>
            <p className="text-muted-foreground mt-2">Para negócios em crescimento</p>
            <div className="mt-4 flex items-baseline text-4xl font-extrabold text-foreground">
              R$ 27,49
              <span className="ml-1 text-xl font-medium text-muted-foreground"> / único</span>
            </div>
          </div>
          <ul className="space-y-4 mb-8 flex-1">
            <li className="flex items-start">
              <Check className="h-5 w-5 text-emerald-500 shrink-0 mr-3" />
              <span className="text-foreground font-medium">Até 80 produtos cadastrados</span>
            </li>
            <li className="flex items-start">
              <Check className="h-5 w-5 text-emerald-500 shrink-0 mr-3" />
              <span className="text-foreground font-medium">Importação via Excel</span>
            </li>
            <li className="flex items-start opacity-50">
              <Check className="h-5 w-5 text-emerald-500 shrink-0 mr-3" />
              <span className="text-foreground line-through">Call de consultoria</span>
            </li>
          </ul>
          <button 
            onClick={() => handleUpgrade('intermediario')}
            disabled={loadingPlan === 'intermediario' || user?.plan === 'intermediario' || user?.plan === 'ilimitado'}
            className="w-full py-3 px-6 rounded-xl font-medium bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-colors disabled:opacity-50"
          >
            {loadingPlan === 'intermediario' ? 'Aguarde...' : (user?.plan === 'intermediario' ? 'Seu Plano Atual' : 'Assinar Intermediário')}
          </button>
        </div>

        {/* Plano Ilimitado */}
        <div className="bg-card border border-border rounded-2xl shadow-sm p-8 flex flex-col h-full">
          <div className="mb-6">
            <h3 className="text-xl font-bold text-foreground">Ilimitado</h3>
            <p className="text-muted-foreground mt-2">Acesso total e suporte</p>
            <div className="mt-4 flex items-baseline text-4xl font-extrabold text-foreground">
              R$ 59,90
              <span className="ml-1 text-xl font-medium text-muted-foreground"> / único</span>
            </div>
          </div>
          <ul className="space-y-4 mb-8 flex-1">
            <li className="flex items-start">
              <Check className="h-5 w-5 text-emerald-500 shrink-0 mr-3" />
              <span className="text-foreground">Produtos ilimitados</span>
            </li>
            <li className="flex items-start">
              <Check className="h-5 w-5 text-emerald-500 shrink-0 mr-3" />
              <span className="text-foreground">Importação via Excel</span>
            </li>
            <li className="flex items-start">
              <Check className="h-5 w-5 text-emerald-500 shrink-0 mr-3" />
              <span className="text-foreground">1 call de consultoria estratégica</span>
            </li>
          </ul>
          <button 
            onClick={() => handleUpgrade('ilimitado')}
            disabled={loadingPlan === 'ilimitado' || user?.plan === 'ilimitado'}
            className="w-full py-3 px-6 rounded-xl font-medium border-2 border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors disabled:opacity-50"
          >
            {loadingPlan === 'ilimitado' ? 'Aguarde...' : (user?.plan === 'ilimitado' ? 'Seu Plano Atual' : 'Assinar Ilimitado')}
          </button>
        </div>
      </div>
    </div>
  );
}
