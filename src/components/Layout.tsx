import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Calculator, Box, Tags, DollarSign, Wallet, FileText, Settings, LogOut, FileSpreadsheet, Percent, Users, TrendingUp, Layers, Menu, X } from 'lucide-react';
import Logo from './Logo';
import { useAppContext } from '../context/AppContext';

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isGuest, logout } = useAppContext();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const menuItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Custos Fixos', path: '/custos-fixos', icon: Wallet },
    { name: 'Custos Variáveis', path: '/custos-variaveis', icon: DollarSign },
    { name: 'Impostos', path: '/impostos', icon: Percent },
    { name: 'Formação de Preço', path: '/formacao-preco', icon: Calculator, highlight: 'bg-red-500/10 text-red-600 border-red-500/20' },
    { name: 'Mix de Preços', path: '/mix-preco', icon: Box, highlight: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
    { name: 'Mix em Lote', path: '/mix-preco-lote', icon: Layers, highlight: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
    { name: 'Relatórios', path: '/relatorios', icon: FileText },
    { name: 'Configurações', path: '/configuracoes', icon: Settings },
  ];

  if (user?.role === 'admin') {
    menuItems.push({ name: 'Administração', path: '/admin', icon: Users, highlight: 'bg-blue-500/10 text-blue-600 border-blue-500/20' });
  }

  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <>
      <div className="h-16 flex items-center justify-between px-6 border-b border-border shrink-0">
        <Logo />
        {isMobile && (
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-2 -mr-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors md:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setIsMobileMenuOpen(false)}
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
            onClick={() => { logout(); setIsMobileMenuOpen(false); }}
            className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground cursor-pointer rounded-md hover:bg-muted transition-colors"
          >
             <LogOut className="h-5 w-5" />
             Sair
          </div>
        ) : (
          <div 
            onClick={() => { navigate('/auth'); setIsMobileMenuOpen(false); }}
            className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-primary hover:text-primary/80 cursor-pointer rounded-md hover:bg-muted transition-colors"
          >
             <LogOut className="h-5 w-5" />
             Fazer Login
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden relative">
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Desktop */}
      <aside className="w-64 bg-card border-r border-border flex-col hidden md:flex shrink-0">
        <SidebarContent />
      </aside>

      {/* Sidebar Mobile */}
      <aside className={`fixed inset-y-0 left-0 w-64 bg-card border-r border-border flex flex-col z-50 transform transition-transform duration-200 ease-in-out md:hidden ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <SidebarContent isMobile={true} />
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {isGuest && (
          <div className="bg-primary/10 border-b border-primary/20 px-6 py-2 flex flex-col sm:flex-row items-start sm:items-center justify-between shrink-0 gap-2">
             <p className="text-sm font-medium text-primary text-center sm:text-left">Você está navegando como visitante. Nenhum dado será salvo.</p>
             <button onClick={() => navigate('/auth')} className="text-sm font-medium bg-primary text-primary-foreground px-3 py-1 rounded hover:bg-primary/90 transition-colors w-full sm:w-auto">
               Faça login gratuitamente
             </button>
          </div>
        )}
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 sm:px-6 shrink-0 md:hidden">
          <Logo />
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 -mr-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
           <div className="max-w-6xl mx-auto">
              {children}
           </div>
        </div>
      </main>
    </div>
  );
}
