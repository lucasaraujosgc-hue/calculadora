import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Calculator, Box, Tags, DollarSign, Wallet, FileText, Settings, LogOut, Crown, FileSpreadsheet, Percent, Users, TrendingUp, Layers, Menu, X, ChevronLeft, ChevronRight, Star } from 'lucide-react';
import Logo from './Logo';
import { useAppContext } from '../context/AppContext';

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isGuest, logout } = useAppContext();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktopMenuOpen, setIsDesktopMenuOpen] = useState(false);

  const menuItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Custos Fixos', path: '/custos-fixos', icon: Wallet },
    { name: 'Produtos', path: '/custos-variaveis', icon: DollarSign },
    { name: 'Impostos', path: '/impostos', icon: Percent },
    { name: 'Formação de Preço', path: '/formacao-preco', icon: Calculator },
    // { name: 'Mix de Preços', path: '/mix-preco', icon: Box, highlight: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
    { name: 'Preços em Lote', path: '/mix-preco-lote', icon: Layers },
    ...(user ? [{ name: 'Planos e Upgrades', path: '/planos', icon: Star, highlight: 'bg-amber-500/10 text-amber-600 border-amber-500/20' }] : []),
    { name: 'Minha Conta', path: '/configuracoes', icon: Settings },
  ];

  if (user?.role === 'admin') {
    menuItems.push({ name: 'Administração', path: '/admin', icon: Users, highlight: 'bg-blue-500/10 text-blue-600 border-blue-500/20' });
  }

  const SidebarContent = ({ isMobile = false, isCollapsed = false, onToggleDesktop }: { isMobile?: boolean, isCollapsed?: boolean, onToggleDesktop?: () => void }) => (
    <>
      <div className={`py-4 flex flex-col items-center justify-center border-b border-border shrink-0 relative`}>
        {!isCollapsed && (
          <>
            <Logo />
            {!isMobile && (
              <button 
                onClick={onToggleDesktop}
                className="absolute top-2 right-2 p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                title="Recolher menu"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
          </>
        )}
        {isCollapsed && !isMobile && (
          <button 
            onClick={onToggleDesktop}
            className="p-2 text-primary hover:bg-muted rounded-md transition-colors mt-2"
            title="Expandir menu"
          >
            <Menu className="w-6 h-6" />
          </button>
        )}
        {isMobile && (
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors md:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
      <div className={`flex-1 overflow-y-auto py-4 ${isCollapsed ? 'px-2' : 'px-3'} space-y-1`}>
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => isMobile && setIsMobileMenuOpen(false)}
              title={isCollapsed ? item.name : undefined}
              className={`flex items-center ${isCollapsed ? 'justify-center p-2' : 'gap-3 px-3 py-2'} rounded-md text-sm font-medium transition-colors border border-transparent ${
                isActive 
                  ? (item.highlight ? item.highlight.replace('/10', '/20') : 'bg-primary text-primary-foreground')
                  : (item.highlight ? `${item.highlight} hover:bg-muted/50` : 'text-muted-foreground hover:bg-muted hover:text-foreground')
              }`}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!isCollapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </div>
      <div className={`p-4 border-t border-border shrink-0 ${isCollapsed ? 'flex justify-center' : ''}`}>
        {user ? (
          <div className="flex flex-col w-full">
            {!isCollapsed && (
              <div className="px-3 mb-4 flex items-center justify-between">
                <div className="flex flex-col overflow-hidden">
                  <span className="text-sm font-semibold truncate text-foreground">{user.name}</span>
                  <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                </div>
                <div title={`Plano Atual: ${user.plan === 'ilimitado' ? 'Ilimitado' : user.plan === 'intermediario' ? 'Intermediário' : user.plan === 'basico' ? 'Básico' : 'Gratuito'}`} className="ml-2 flex shrink-0 items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary">
                  {user.plan && user.plan !== 'free' && user.plan !== 'gratuito' ? (
                    <Crown className="w-5 h-5 fill-current text-amber-500" />
                  ) : (
                    <Star className="w-4 h-4" />
                  )}
                </div>
              </div>
            )}
            <div 
              onClick={() => { logout(); setIsMobileMenuOpen(false); }}
              title={isCollapsed ? "Sair" : undefined}
            className={`flex items-center ${isCollapsed ? 'justify-center p-2' : 'gap-3 px-3 py-2'} text-sm font-medium text-muted-foreground hover:text-foreground cursor-pointer rounded-md hover:bg-muted transition-colors`}
          >
             <LogOut className="h-5 w-5 shrink-0" />
             {!isCollapsed && <span>Sair</span>}
          </div>
          </div>
        ) : (
          <div 
            onClick={() => { navigate('/auth'); setIsMobileMenuOpen(false); }}
            title={isCollapsed ? "Fazer Login" : undefined}
            className={`flex items-center ${isCollapsed ? 'justify-center p-2' : 'gap-3 px-3 py-2'} text-sm font-medium text-primary hover:text-primary/80 cursor-pointer rounded-md hover:bg-muted transition-colors`}
          >
             <LogOut className="h-5 w-5 shrink-0" />
             {!isCollapsed && <span>Fazer Login</span>}
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
      <aside 
        className={`bg-card border-r border-border flex-col hidden md:flex shrink-0 transition-all duration-300 relative z-30 ${isDesktopMenuOpen ? 'w-64' : 'w-16'}`}
      >
        <SidebarContent isCollapsed={!isDesktopMenuOpen} onToggleDesktop={() => setIsDesktopMenuOpen(!isDesktopMenuOpen)} />
      </aside>

      {/* Sidebar Mobile */}
      <aside className={`fixed inset-y-0 left-0 w-64 bg-card border-r border-border flex flex-col z-50 transform transition-transform duration-200 ease-in-out md:hidden ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <SidebarContent isMobile={true} />
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden w-full relative z-10">
        {isGuest && (
          <div className="bg-primary/10 border-b border-primary/20 px-6 py-2 flex flex-col sm:flex-row items-start sm:items-center justify-between shrink-0 gap-2">
             <p className="text-sm font-medium text-primary text-center sm:text-left">Você está navegando como visitante. Nenhum dado será salvo.</p>
             <button onClick={() => navigate('/auth')} className="text-sm font-medium bg-primary text-primary-foreground px-3 py-1 rounded hover:bg-primary/90 transition-colors w-full sm:w-auto">
               Faça login gratuitamente
             </button>
          </div>
        )}
        <header className="py-3 bg-card border-b border-border flex items-center justify-between px-4 sm:px-6 shrink-0 md:hidden">
          <Logo />
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 -mr-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
           <div className="w-full max-w-[1600px] mx-auto">
              {children}
           </div>
        </div>
      </main>
    </div>
  );
}
