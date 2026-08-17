import React, { createContext, useContext, useState, useEffect } from 'react';

export type User = {
  name: string;
  email: string;
  phone: string;
  role?: string;
  isActivated?: boolean;
  plan?: string | null;
  productLimit?: number;
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

export type SnapshotItem = {
  id: string;
  createdAt: string;
  label: string;
  custoFixoTotal: number;
  produtos: ProdutoItem[];
  custosFixos: CustoFixoItem[];
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
  saveProduto: (p: ProdutoItem) => Promise<void>;
  syncProdutos: (ps: ProdutoItem[]) => Promise<void>;
  removeProduto: (id: string) => Promise<void>;
  saveCustoFixo: (c: CustoFixoItem) => Promise<void>;
  removeCustoFixo: (id: string) => Promise<void>;
  snapshots: SnapshotItem[];
  fetchSnapshots: () => Promise<void>;
  createSnapshot: () => Promise<void>;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

const defaultCustos = [
  { id: '1', nome: 'Aluguel', valor: 2500 },
  { id: '2', nome: 'Energia', valor: 800 },
  { id: '3', nome: 'Internet', valor: 150 },
];

const defaultProdutos = [
  { id: '1', nome: 'Cimento CP II 50 kg', cmv: 32.20, vendasProjetadas: 300, imposto: 8, taxaCartao: 5, comissao: 2, margem: 25, percentualRateio: 20 },
  { id: '2', nome: 'Tijolo Cerâmico 9x19x19', cmv: 0.87, vendasProjetadas: 2000, imposto: 8, taxaCartao: 5, comissao: 2, margem: 25, percentualRateio: 20 },
  { id: '3', nome: 'Argamassa AC-II 20 kg', cmv: 19.30, vendasProjetadas: 200, imposto: 8, taxaCartao: 5, comissao: 2, margem: 25, percentualRateio: 20 },
  { id: '4', nome: 'Tinta Acrílica Branca 18 L', cmv: 172.50, vendasProjetadas: 80, imposto: 8, taxaCartao: 5, comissao: 2, margem: 25, percentualRateio: 20 },
  { id: '5', nome: 'Tubo PVC Soldável 25 mm (3 m)', cmv: 18.50, vendasProjetadas: 150, imposto: 8, taxaCartao: 5, comissao: 2, margem: 25, percentualRateio: 20 },
];

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
    const saved = localStorage.getItem('vc_custos') || sessionStorage.getItem('vc_custos');
    const parsed = saved ? JSON.parse(saved) : null;
    return parsed && parsed.length > 0 ? parsed : defaultCustos;
  });
  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([]);
  const [produtos, setProdutos] = useState<ProdutoItem[]>(() => {
    const saved = localStorage.getItem('vc_produtos') || sessionStorage.getItem('vc_produtos');
    const parsed = saved ? JSON.parse(saved) : null;
    return parsed && parsed.length > 0 ? parsed : defaultProdutos;
  });

  // Update product limit and plan when coming back to app (e.g., after checkout)
  useEffect(() => {
    if (user) {
      fetch('/api/me')
        .then(res => res.json())
        .then(data => {
          if (data.success && data.user) {
            setUser(data.user);
            const isLocal = !!localStorage.getItem('vc_user');
            if (isLocal) {
              localStorage.setItem('vc_user', JSON.stringify(data.user));
            } else {
              sessionStorage.setItem('vc_user', JSON.stringify(data.user));
            }
          }
        })
        .catch(err => console.error("Error fetching user data:", err));
    }
  }, []);

  // Load user specific or guest data
  useEffect(() => {
    if (user && !isGuest) {
      // Fetch from API
      Promise.all([
        fetch('/api/fixed-costs').then(res => res.json()),
        fetch('/api/products').then(res => res.json())
      ]).then(([custos, prods]) => {
        if (Array.isArray(custos)) setCustosFixos(custos);
        if (Array.isArray(prods)) setProdutos(prods);
      }).catch(err => {
        console.error("Error loading data from API", err);
      });
    } else {
      // Guest mode
      const savedCustos = localStorage.getItem('vc_custos') || sessionStorage.getItem('vc_custos');
      if (savedCustos) {
        const parsed = JSON.parse(savedCustos);
        setCustosFixos(parsed.length > 0 ? parsed : [...defaultCustos]);
      } else {
        setCustosFixos([...defaultCustos]);
      }

      const savedProdutos = localStorage.getItem('vc_produtos') || sessionStorage.getItem('vc_produtos');
      if (savedProdutos) {
        const parsed = JSON.parse(savedProdutos);
        setProdutos(parsed.length > 0 ? parsed : [...defaultProdutos]);
      } else {
        setProdutos([...defaultProdutos]);
      }
    }
  }, [user, isGuest]);

  // Save data when they change (only for guest)
  useEffect(() => {
    // Only save if data is loaded and not during an initial uninitialized state
    if (!custosFixos || !produtos) return;
    
    // Prevent saving empty arrays over the initial defaults if they haven't been properly loaded
    if (custosFixos.length === 0 && produtos.length === 0 && isGuest) {
      const savedCustos = localStorage.getItem('vc_custos') || sessionStorage.getItem('vc_custos');
      if (!savedCustos) return; // Wait until populated
    }

    if (!user || isGuest) {
      const storage = localStorage.getItem('vc_custos') ? localStorage : sessionStorage;
      storage.setItem('vc_custos', JSON.stringify(custosFixos));
      storage.setItem('vc_produtos', JSON.stringify(produtos));
    }
  }, [custosFixos, produtos, user, isGuest]);

  const login = (u: User, remember: boolean) => {
    setUser(u);
    if (remember) {
      localStorage.setItem('vc_user', JSON.stringify(u));
    } else {
      sessionStorage.setItem('vc_user', JSON.stringify(u));
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

  
  const fetchSnapshots = async () => {
    if (user && !isGuest) {
      try {
        const res = await fetch('/api/snapshots');
        if (res.ok) {
          const data = await res.json();
          setSnapshots(data);
        }
      } catch(e) {}
    }
  };

  const createSnapshot = async () => {
    if (user && !isGuest) {
      try {
        const res = await fetch('/api/snapshots', { method: 'POST' });
        if (res.ok) {
          await fetchSnapshots();
        }
      } catch(e) {}
    }
  };

  useEffect(() => {
    if (user && !isGuest) {
      fetchSnapshots();
      // Auto-create snapshot on login/mount once
      createSnapshot();
    } else {
      setSnapshots([]);
    }
  }, [user, isGuest]);

  const saveProduto = async (p: ProdutoItem) => {
    if (user && !isGuest) {
      const isExisting = produtos.find(prod => prod.id === p.id);
      const url = isExisting ? `/api/products/${p.id}` : '/api/products';
      const method = isExisting ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar produto");
      
      setProdutos(prev => {
        if (isExisting) return prev.map(prod => prod.id === p.id ? data.product : prod);
        return [...prev, data.product || data];
      });
    } else {
      setProdutos(prev => {
        const isExisting = prev.find(prod => prod.id === p.id);
        if (isExisting) return prev.map(prod => prod.id === p.id ? p : prod);
        return [...prev, p];
      });
    }
  };

    const syncProdutos = async (ps: ProdutoItem[]) => {
    if (user && !isGuest) {
      const res = await fetch('/api/products/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ps)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro ao sincronizar produtos");
      }
      const data = await res.json();
      // Data might be slightly different shaped (backend sends back the updated array).
      // Since it's a sync, it's probably best to just set them:
      setProdutos(ps); 
    } else {
      setProdutos(ps);
    }
  };

  const removeProduto = async (id: string) => {
    if (user && !isGuest) {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error("Erro ao excluir produto");
    }
    setProdutos(prev => prev.filter(p => p.id !== id));
  };

  const saveCustoFixo = async (c: CustoFixoItem) => {
    if (user && !isGuest) {
      const isExisting = custosFixos.find(cust => cust.id === c.id);
      const url = isExisting ? `/api/fixed-costs/${c.id}` : '/api/fixed-costs';
      const method = isExisting ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar custo fixo");
      
      setCustosFixos(prev => {
        if (isExisting) return prev.map(cust => cust.id === c.id ? data.cost : cust);
        return [...prev, data.cost || data];
      });
    } else {
      setCustosFixos(prev => {
        const isExisting = prev.find(cust => cust.id === c.id);
        if (isExisting) return prev.map(cust => cust.id === c.id ? c : cust);
        return [...prev, c];
      });
    }
  };

  const removeCustoFixo = async (id: string) => {
    if (user && !isGuest) {
      const res = await fetch(`/api/fixed-costs/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error("Erro ao excluir custo fixo");
    }
    setCustosFixos(prev => prev.filter(c => c.id !== id));
  };

  return (
    <AppContext.Provider value={{ 
      user, login, logout, isGuest, setGuestMode,
      custosFixos, setCustosFixos,
      produtos, setProdutos,
      saveProduto, removeProduto, syncProdutos,
      saveCustoFixo, removeCustoFixo,
      snapshots, fetchSnapshots, createSnapshot
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
