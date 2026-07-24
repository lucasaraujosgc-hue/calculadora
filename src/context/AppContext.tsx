import React, { createContext, useContext, useState, useEffect } from 'react';

export type User = {
  name: string;
  email: string;
  phone: string;
};

export type CustoFixoItem = {
  id: string;
  nome: string;
  valor: number;
};

export type ProdutoItem = {
  id: string;
  nome: string;
  cmv: number;
  vendasProjetadas?: number;
  imposto?: number;
  taxaCartao?: number;
  comissao?: number;
  margem?: number;
  precoIdeal?: number;
  percentualRateio?: number;
};

type AppContextType = {
  user: User | null;
  login: (u: User, remember: boolean) => void;
  logout: () => void;
  isGuest: boolean;
  setGuestMode: (v: boolean) => void;
  
  custosFixos: CustoFixoItem[];
  setCustosFixos: (cf: CustoFixoItem[]) => void;
  produtos: ProdutoItem[];
  setProdutos: (p: ProdutoItem[]) => void;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const localUser = localStorage.getItem('vc_user');
    if (localUser) return JSON.parse(localUser);
    const sessionUser = sessionStorage.getItem('vc_user');
    if (sessionUser) return JSON.parse(sessionUser);
    return null;
  });

  const [isGuest, setIsGuest] = useState<boolean>(() => {
    const localUser = localStorage.getItem('vc_user');
    const sessionUser = sessionStorage.getItem('vc_user');
    return !(localUser || sessionUser);
  });

  const [custosFixos, setCustosFixos] = useState<CustoFixoItem[]>(() => {
    const saved = localStorage.getItem('vc_custos');
    if (saved) return JSON.parse(saved);
    const session = sessionStorage.getItem('vc_custos');
    if (session) return JSON.parse(session);
    return [
      { id: '1', nome: 'Aluguel', valor: 2500 },
      { id: '2', nome: 'Energia', valor: 800 },
      { id: '3', nome: 'Internet', valor: 150 },
    ];
  });

  const [produtos, setProdutos] = useState<ProdutoItem[]>(() => {
    const saved = localStorage.getItem('vc_produtos');
    if (saved) return JSON.parse(saved);
    const session = sessionStorage.getItem('vc_produtos');
    if (session) return JSON.parse(session);
    return [
      { id: '1', nome: 'Produto Exemplo', cmv: 50, vendasProjetadas: 100, imposto: 10, taxaCartao: 3, comissao: 2, margem: 20 },
    ];
  });

  // Salvar dados quando mudam
  useEffect(() => {
    const storage = user && localStorage.getItem('vc_user') ? localStorage : sessionStorage;
    storage.setItem('vc_custos', JSON.stringify(custosFixos));
    storage.setItem('vc_produtos', JSON.stringify(produtos));
  }, [custosFixos, produtos, user]);

  const login = (u: User, remember: boolean) => {
    setUser(u);
    if (remember) {
      localStorage.setItem('vc_user', JSON.stringify(u));
      localStorage.setItem('vc_custos', JSON.stringify(custosFixos));
      localStorage.setItem('vc_produtos', JSON.stringify(produtos));
    } else {
      sessionStorage.setItem('vc_user', JSON.stringify(u));
      sessionStorage.setItem('vc_custos', JSON.stringify(custosFixos));
      sessionStorage.setItem('vc_produtos', JSON.stringify(produtos));
    }
    setIsGuest(false);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('vc_user');
    sessionStorage.removeItem('vc_user');
    setIsGuest(true);
  };

  const setGuestMode = (v: boolean) => {
    setIsGuest(v);
  };

  return (
    <AppContext.Provider value={{ 
      user, login, logout, isGuest, setGuestMode,
      custosFixos, setCustosFixos,
      produtos, setProdutos
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
