import React, { createContext, useContext, useState, useEffect } from 'react';

export type User = {
  name: string;
  email: string;
  phone: string;
  role?: string;
  isActivated?: boolean;
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
  modoPrecificacao?: 'margem' | 'preco';
  precoFixo?: number;
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
    return [
      { id: '1', nome: 'Cimento CP II 50 kg', cmv: 32.20, vendasProjetadas: 95, imposto: 8, taxaCartao: 2, comissao: 0, margem: 15 },
      { id: '2', nome: 'Tijolo Cerâmico 9x19x19', cmv: 0.87, vendasProjetadas: 100, imposto: 8, taxaCartao: 2, comissao: 0, margem: 15 },
      { id: '3', nome: 'Argamassa AC-II 20 kg', cmv: 19.30, vendasProjetadas: 60, imposto: 8, taxaCartao: 2, comissao: 0, margem: 15 },
      { id: '4', nome: 'Tinta Acrílica Branca 18 L', cmv: 172.50, vendasProjetadas: 28, imposto: 8, taxaCartao: 2, comissao: 0, margem: 15 },
      { id: '5', nome: 'Tubo PVC Soldável 25 mm (3 m)', cmv: 18.50, vendasProjetadas: 45, imposto: 8, taxaCartao: 2, comissao: 0, margem: 15 },
      { id: '6', nome: 'Fio Flexível 2,5 mm² (100 m)', cmv: 254.00, vendasProjetadas: 22, imposto: 8, taxaCartao: 2, comissao: 0, margem: 15 },
      { id: '7', nome: 'Torneira Plástica para Jardim', cmv: 8.30, vendasProjetadas: 75, imposto: 8, taxaCartao: 2, comissao: 0, margem: 15 },
      { id: '8', nome: 'Telha Fibrocimento 2,44 m', cmv: 60.50, vendasProjetadas: 35, imposto: 8, taxaCartao: 2, comissao: 0, margem: 15 },
      { id: '9', nome: 'Fechadura Externa Inox', cmv: 49.50, vendasProjetadas: 40, imposto: 8, taxaCartao: 2, comissao: 0, margem: 15 },
      { id: '10', nome: 'Lâmpada LED 12W', cmv: 8.50, vendasProjetadas: 90, imposto: 8, taxaCartao: 2, comissao: 0, margem: 15 },
    ];
  });

  // Salvar dados quando mudam
  useEffect(() => {
    const storage = user && localStorage.getItem('vc_user') ? localStorage : sessionStorage;
    storage.setItem('vc_custos', JSON.stringify(custosFixos));
  }, [custosFixos, user]);

  const login = (u: User, remember: boolean) => {
    setUser(u);
    if (remember) {
      localStorage.setItem('vc_user', JSON.stringify(u));
      localStorage.setItem('vc_custos', JSON.stringify(custosFixos));
    } else {
      sessionStorage.setItem('vc_user', JSON.stringify(u));
      sessionStorage.setItem('vc_custos', JSON.stringify(custosFixos));
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
