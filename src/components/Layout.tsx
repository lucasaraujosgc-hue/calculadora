import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Calculator, Box, Tags, DollarSign, Wallet, FileText, Settings, LogOut, FileSpreadsheet, Percent, Users, TrendingUp } from 'lucide-react';
import Logo from './Logo';
import { useAppContext } from '../context/AppContext';

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isGuest, logout } = useAppContext();

  const menuItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Custos Fixos', path: '/custos-fixos', icon: Wallet },
    { name: 'Custos Variáveis', path: '/custos-variaveis', icon: DollarSign },
    { name: 'Impostos', path: '/impostos', icon: Percent },
    { name: 'Formação de Preço', path: '/formacao-preco', icon: Calculator, highlight: 'bg-red-500/10 text-red-600 border-red-500/20' },
    { name: 'Mix de Preços', path: '/mix-preco', icon: Box, highlight: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
    { name: 'Relatórios', path: '/relatorios', icon: FileText },
    { name: 'Configurações', path: '/configuracoes', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border flex flex-col hidden md:flex shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-border shrink-0">
          <Logo />
        </div>
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors border border-transparent ${
                  isActive 
                    ? (item.highlight ? item.highlight.replace('/10', '/20') : 'bg-primary text-primary-foreground')
                    : (item.highlight ? `${item.highlight} hover:bg-muted/50` : 'text-muted-foreground hover:bg-muted hover:text-foreground')
                }`}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {item.name}
              </Link>
            );
          })}
        </div>
        <div className="p-4 border-t border-border shrink-0">
          {user ? (
            <div 
              onClick={() => logout()}
              className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground cursor-pointer rounded-md hover:bg-muted transition-colors"
            >
               <LogOut className="h-5 w-5" />
               Sair
            </div>
          ) : (
            <div 
              onClick={() => navigate('/auth')}
              className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-primary hover:text-primary/80 cursor-pointer rounded-md hover:bg-muted transition-colors"
            >
               <LogOut className="h-5 w-5" />
               Fazer Login
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {isGuest && (
          <div className="bg-primary/10 border-b border-primary/20 px-6 py-2 flex flex-col sm:flex-row items-start sm:items-center justify-between shrink-0 gap-2">
             <p className="text-sm font-medium text-primary">Você está navegando como visitante. Nenhum dado será salvo.</p>
             <button onClick={() => navigate('/auth')} className="text-sm font-medium bg-primary text-primary-foreground px-3 py-1 rounded hover:bg-primary/90 transition-colors">
               Faça login gratuitamente para salvar
             </button>
          </div>
        )}
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 shrink-0 md:hidden">
          <Logo />
        </header>
        <div className="flex-1 overflow-y-auto p-6">
           <div className="max-w-6xl mx-auto">
              {children}
           </div>
        </div>
      </main>
    </div>
  );
}
