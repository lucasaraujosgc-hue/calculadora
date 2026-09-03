import React, { useState, useEffect } from 'react';
import { Check, Star, Gift } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

type Plan = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  productLimit: number | null;
  excelImport: boolean;
  consultingCall: boolean;
};

const CARD_STYLE: Record<string, { card: string; button: string }> = {
  basico: {
    card: 'bg-card border border-border rounded-2xl shadow-sm p-8 flex flex-col h-full',
    button: 'w-full py-3 px-6 rounded-xl font-medium border-2 border-primary text-primary hover:bg-primary/5 transition-colors disabled:opacity-50',
  },
  intermediario: {
    card: 'bg-primary/5 border-2 border-primary rounded-2xl shadow-md p-8 flex flex-col h-full relative transform md:-translate-y-4',
    button: 'w-full py-3 px-6 rounded-xl font-medium bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-colors disabled:opacity-50',
  },
  ilimitado: {
    card: 'bg-card border border-border rounded-2xl shadow-sm p-8 flex flex-col h-full',
    button: 'w-full py-3 px-6 rounded-xl font-medium border-2 border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors disabled:opacity-50',
  },
};

export default function Pricing() {
  const { user, freeModeEnabled } = useAppContext();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => {
    fetch('/api/plans')
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setPlans(data); })
      .catch(err => console.error(err));
  }, []);

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

  const formatPrice = (cents: number) => (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const userPlanIndex = plans.findIndex(p => p.id === user?.plan);

  if (freeModeEnabled) {
    return (
      <div className="py-12 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <Gift className="w-14 h-14 text-primary mx-auto mb-4" />
        <h2 className="text-4xl font-serif text-foreground">Acesso gratuito e ilimitado</h2>
        <p className="mt-4 text-lg text-muted-foreground">
          Por tempo limitado, todos os cadastros têm acesso ilimitado à calculadora, sem custo. Aproveite!
        </p>
      </div>
    );
  }

  if (plans.length === 0) {
    return <div className="py-24 text-center text-muted-foreground">Carregando planos...</div>;
  }

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
        {plans.map((plan, i) => {
          const isPopular = plan.id === 'intermediario';
          const isCurrent = user?.plan === plan.id;
          const disabled = loadingPlan === plan.id || (userPlanIndex !== -1 && userPlanIndex >= i);
          const style = CARD_STYLE[plan.id] || CARD_STYLE.basico;

          return (
            <div key={plan.id} className={style.card}>
              {isPopular && (
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                  <span className="bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wide py-1 px-4 rounded-full flex items-center gap-1 shadow-sm">
                    <Star className="w-3 h-3 fill-current" />
                    Mais Popular
                  </span>
                </div>
              )}
              <div className="mb-6">
                <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
                <p className="text-muted-foreground mt-2">{plan.description}</p>
                <div className="mt-4 flex items-baseline text-4xl font-extrabold text-foreground">
                  R$ {formatPrice(plan.priceCents)}
                  <span className="ml-1 text-xl font-medium text-muted-foreground"> / único</span>
                </div>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-start">
                  <Check className="h-5 w-5 text-emerald-500 shrink-0 mr-3" />
                  <span className="text-foreground">
                    {plan.productLimit === null ? 'Produtos ilimitados' : `Até ${plan.productLimit} produtos cadastrados`}
                  </span>
                </li>
                <li className={`flex items-start ${plan.excelImport ? '' : 'opacity-50'}`}>
                  <Check className="h-5 w-5 text-emerald-500 shrink-0 mr-3" />
                  <span className={`text-foreground ${plan.excelImport ? '' : 'line-through'}`}>Importação via Excel</span>
                </li>
                <li className={`flex items-start ${plan.consultingCall ? '' : 'opacity-50'}`}>
                  <Check className="h-5 w-5 text-emerald-500 shrink-0 mr-3" />
                  <span className={`text-foreground ${plan.consultingCall ? '' : 'line-through'}`}>
                    {plan.consultingCall ? '1 call de consultoria estratégica' : 'Call de consultoria'}
                  </span>
                </li>
              </ul>
              <button
                onClick={() => handleUpgrade(plan.id)}
                disabled={disabled}
                className={style.button}
              >
                {loadingPlan === plan.id ? 'Aguarde...' : (isCurrent ? 'Seu Plano Atual' : `Assinar ${plan.name}`)}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
