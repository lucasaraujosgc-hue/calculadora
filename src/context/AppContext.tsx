import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

export type User = {
  name: string;
  email: string;
  phone: string;
  role?: string;
  isActivated?: boolean;
  plan?: string | null;
  productLimit?: number;
  /** CNPJ ou CPF da empresa, só dígitos. Usado para classificar os XMLs de nota. */
  taxId?: string | null;
};

export type CustoFixoItem = {
  id: string;
  nome: string;
  valor: number;
};

/**
 * Uma despesa variável criada pelo próprio usuário (ex.: "Frete", "Embalagem").
 * A lista é individual: vem de /api/variable-expenses, que filtra por usuário,
 * ou do armazenamento local do navegador no modo visitante.
 */
export type DespesaVariavelItem = {
  id: string;
  nome: string;
  posicao?: number;
};

/**
 * Uma faixa de margem nomeada — "Atração", "Padrão", "Margem alta".
 * Cada usuário tem as suas; toda conta nasce com três, editáveis.
 */
export type EstrategiaItem = {
  id: string;
  nome: string;
  margem: number;
  /** Margem mínima aceitável; 0 = sem piso. */
  piso?: number;
  cor?: string;
  posicao?: number;
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
  precoVenda?: number;
  /** Percentual de cada despesa variável personalizada, por id da despesa. */
  despesasVariaveis?: Record<string, number>;
  /** Faixa de margem que o produto segue; null = Personalizado. */
  estrategiaId?: string | null;
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
  freeModeEnabled: boolean;
  /** Planos pagos ligados. Desligados, nada de plano aparece na interface. */
  planosAtivos: boolean;
  salvarDocumentoEmpresa: (taxId: string) => Promise<void>;

  custosFixos: CustoFixoItem[];
  setCustosFixos: (cf: CustoFixoItem[]) => void;
  produtos: ProdutoItem[];
  setProdutos: (p: ProdutoItem[]) => void;
  saveProduto: (p: ProdutoItem) => Promise<void>;
  syncProdutos: (ps: ProdutoItem[]) => Promise<void>;
  removeProduto: (id: string) => Promise<void>;
  saveCustoFixo: (c: CustoFixoItem) => Promise<void>;
  removeCustoFixo: (id: string) => Promise<void>;

  despesasVariaveis: DespesaVariavelItem[];
  addDespesaVariavel: (nome: string) => Promise<void>;
  renameDespesaVariavel: (id: string, nome: string) => Promise<void>;
  removeDespesaVariavel: (id: string) => Promise<void>;

  estrategias: EstrategiaItem[];
  addEstrategia: (nome: string, margem: number) => Promise<void>;
  updateEstrategia: (id: string, patch: { nome?: string; margem?: number; piso?: number }) => Promise<void>;
  removeEstrategia: (id: string) => Promise<void>;
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

  const [freeModeEnabled, setFreeModeEnabled] = useState<boolean>(false);
  const [planosAtivos, setPlanosAtivos] = useState<boolean>(false);

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => { setFreeModeEnabled(!!data.freeModeEnabled); setPlanosAtivos(!!data.planosAtivos); })
      .catch(() => {});
  }, []);

  const [custosFixos, setCustosFixos] = useState<CustoFixoItem[]>(() => {
    const saved = localStorage.getItem('vc_custos') || sessionStorage.getItem('vc_custos');
    const parsed = saved ? JSON.parse(saved) : null;
    return parsed && parsed.length > 0 ? parsed : defaultCustos;
  });
  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([]);
  // A lista de despesas variáveis do usuário. No modo visitante fica só no
  // navegador; logado, vem da API já filtrada pelo userId — o que um usuário
  // cria nunca aparece na conta de outro.
  const [despesasVariaveis, setDespesasVariaveis] = useState<DespesaVariavelItem[]>(() => {
    const saved = localStorage.getItem('vc_despesas_variaveis') || sessionStorage.getItem('vc_despesas_variaveis');
    return saved ? JSON.parse(saved) : [];
  });

  // As três faixas com que toda conta começa — as mesmas que o servidor semeia
  // no primeiro acesso, repetidas aqui para o modo visitante nascer igual.
  const estrategiasPadrao: EstrategiaItem[] = [
    { id: 'estrategia-sem-margem', nome: 'Sem margem', margem: 0, piso: 0, cor: 'rose', posicao: 0 },
    { id: 'estrategia-atracao', nome: 'Atração', margem: 10, piso: 5, cor: 'sky', posicao: 1 },
    { id: 'estrategia-padrao', nome: 'Padrão', margem: 20, piso: 0, cor: 'slate', posicao: 2 },
    { id: 'estrategia-alta', nome: 'Margem alta', margem: 30, piso: 0, cor: 'emerald', posicao: 3 },
  ];

  const [estrategias, setEstrategias] = useState<EstrategiaItem[]>(() => {
    const saved = localStorage.getItem('vc_estrategias') || sessionStorage.getItem('vc_estrategias');
    const parsed = saved ? JSON.parse(saved) : null;
    return parsed && parsed.length > 0 ? parsed : estrategiasPadrao;
  });
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
        fetch('/api/products').then(res => res.json()),
        fetch('/api/variable-expenses').then(res => res.json()),
        fetch('/api/pricing-strategies').then(res => res.json())
      ]).then(([custos, prods, despesas, estrats]) => {
        if (Array.isArray(custos)) setCustosFixos(custos);
        if (Array.isArray(prods)) setProdutos(prods);
        if (Array.isArray(despesas)) setDespesasVariaveis(despesas);
        if (Array.isArray(estrats) && estrats.length > 0) setEstrategias(estrats);
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
      storage.setItem('vc_despesas_variaveis', JSON.stringify(despesasVariaveis));
      storage.setItem('vc_estrategias', JSON.stringify(estrategias));
    }
  }, [custosFixos, produtos, despesasVariaveis, estrategias, user, isGuest]);

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

  // O CNPJ/CPF fica junto do usuário porque é ele que separa compra de venda na
  // importação de XML. Guardamos também no storage local para a tela não
  // esquecer o valor num recarregamento.
  const salvarDocumentoEmpresa = async (taxId: string) => {
    const res = await fetch('/api/me', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taxId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao salvar o CNPJ/CPF');
    setUser(prev => {
      const atualizado = { ...(prev as User), ...data.user };
      const storage = localStorage.getItem('vc_user') ? localStorage : sessionStorage;
      try { storage.setItem('vc_user', JSON.stringify(atualizado)); } catch { /* storage bloqueado */ }
      return atualizado;
    });
  };

  
  // --- Estratégias de margem -----------------------------------------------

  const MAX_ESTRATEGIAS = 8;

  const addEstrategia = async (nomeBruto: string, margem: number) => {
    const nome = nomeBruto.trim().replace(/\s+/g, ' ');
    if (!nome) throw new Error('Dê um nome para a estratégia.');
    if (!Number.isFinite(margem) || margem < 0 || margem >= 100) {
      throw new Error('A margem precisa ficar entre 0% e 99%.');
    }
    if (estrategias.some(e => e.nome.toLowerCase() === nome.toLowerCase())) {
      throw new Error(`Você já tem uma estratégia chamada "${nome}".`);
    }
    if (estrategias.length >= MAX_ESTRATEGIAS) {
      throw new Error(`Você já tem ${MAX_ESTRATEGIAS} estratégias. Remova alguma para criar outra.`);
    }

    if (user && !isGuest) {
      const res = await fetch('/api/pricing-strategies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, margem })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao criar a estratégia');
      setEstrategias(prev => [...prev, data.estrategia]);
    } else {
      setEstrategias(prev => [
        ...prev,
        { id: crypto.randomUUID(), nome, margem, piso: 0, cor: 'slate', posicao: prev.length }
      ]);
    }
  };

  const updateEstrategia = async (id: string, patch: { nome?: string; margem?: number; piso?: number }) => {
    const nome = patch.nome !== undefined ? patch.nome.trim().replace(/\s+/g, ' ') : undefined;
    if (nome !== undefined && !nome) throw new Error('Dê um nome para a estratégia.');
    if (nome !== undefined && estrategias.some(e => e.id !== id && e.nome.toLowerCase() === nome.toLowerCase())) {
      throw new Error(`Você já tem uma estratégia chamada "${nome}".`);
    }
    if (patch.margem !== undefined && (!Number.isFinite(patch.margem) || patch.margem < 0 || patch.margem >= 100)) {
      throw new Error('A margem precisa ficar entre 0% e 99%.');
    }

    const atual = estrategias.find(e => e.id === id);
    const margemFinal = patch.margem ?? atual?.margem ?? 0;
    if (patch.piso !== undefined && (!Number.isFinite(patch.piso) || patch.piso < 0 || patch.piso > margemFinal)) {
      throw new Error('O piso precisa ficar entre 0% e a margem alvo da estratégia.');
    }
    // Baixar a margem abaixo do piso arrasta o piso junto, senão a faixa nasce
    // violando o próprio limite.
    const pisoFinal = patch.piso !== undefined
      ? patch.piso
      : (patch.margem !== undefined && (atual?.piso ?? 0) > margemFinal ? margemFinal : undefined);

    if (user && !isGuest) {
      const res = await fetch(`/api/pricing-strategies/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...patch, nome, piso: pisoFinal })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar a estratégia');
    }
    setEstrategias(prev => prev.map(e => (e.id === id ? {
      ...e,
      ...(nome !== undefined ? { nome } : {}),
      ...(patch.margem !== undefined ? { margem: patch.margem } : {}),
      ...(pisoFinal !== undefined ? { piso: pisoFinal } : {}),
    } : e)));
  };

  const removeEstrategia = async (id: string) => {
    const alvo = estrategias.find(e => e.id === id);
    if (!alvo) return;

    if (user && !isGuest) {
      const res = await fetch(`/api/pricing-strategies/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erro ao excluir a estratégia');
      }
    }

    // Quem seguia a faixa vira Personalizado com a margem que ela tinha, para o
    // preço não mudar no momento da exclusão. O servidor faz o mesmo no banco.
    setProdutos(prev => prev.map(p => (
      p.estrategiaId === id ? { ...p, estrategiaId: null, margem: alvo.margem } : p
    )));
    setEstrategias(prev => prev.filter(e => e.id !== id));
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

  // Salvamento agrupado do mix.
  //
  // A tela de Preços em Lote chama o sync a cada tecla digitada em Vendas,
  // Rateio, Preço e CMV. Sem o agrupamento abaixo, cada caractere virava uma
  // gravação do mix inteiro — e várias delas ficavam em voo ao mesmo tempo,
  // podendo chegar fora de ordem e gravar um valor velho por último.
  //
  // O estado local muda na hora (a digitação não trava); a rede espera a pausa.
  const syncTimerRef = useRef<number | null>(null);
  const pendenteRef = useRef<ProdutoItem[] | null>(null);
  const enviandoRef = useRef(false);

  // Função simples, não memoizada: ela só toca refs e o setProdutos, então a
  // identidade dela entre renders não importa — e a chamada recursiva no final
  // (para reenviar o que chegou durante o envio) impede a memoização mesmo.
  const enviarProdutos = async (): Promise<void> => {
    const aEnviar = pendenteRef.current;
    if (!aEnviar || enviandoRef.current) return;

    enviandoRef.current = true;
    try {
      const res = await fetch('/api/products/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aEnviar)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erro ao sincronizar produtos');
      }
      const data = await res.json();

      // Produtos criados offline ganham id de verdade no banco, e é a resposta
      // que traz esse id. Só adotamos a lista do servidor se nada foi digitado
      // enquanto a requisição estava em voo — caso contrário a adoção
      // sobrescreveria o que a pessoa acabou de escrever, e a próxima rodada
      // concilia de novo.
      if (pendenteRef.current === aEnviar && Array.isArray(data.products)) {
        pendenteRef.current = null;
        setProdutos(data.products);
      }
    } finally {
      enviandoRef.current = false;
      // Chegou edição nova durante o envio: manda o que ficou para trás.
      if (pendenteRef.current && pendenteRef.current !== aEnviar) {
        void enviarProdutos();
      }
    }
  };

  const syncProdutos = async (ps: ProdutoItem[]) => {
    setProdutos(ps);
    if (!user || isGuest) return;

    pendenteRef.current = ps;
    if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    syncTimerRef.current = window.setTimeout(() => {
      syncTimerRef.current = null;
      void enviarProdutos();
    }, 700);
  };

  // Fechar a aba no meio da pausa não pode custar as últimas edições.
  useEffect(() => {
    const salvarPendente = () => {
      if (!pendenteRef.current || !user || isGuest) return;
      if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
      navigator.sendBeacon?.(
        '/api/products/sync',
        new Blob([JSON.stringify(pendenteRef.current)], { type: 'application/json' })
      );
    };
    window.addEventListener('beforeunload', salvarPendente);
    return () => {
      window.removeEventListener('beforeunload', salvarPendente);
      if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    };
  }, [user, isGuest]);

  // --- Despesas variáveis personalizadas -----------------------------------
  //
  // No modo visitante tudo acontece no navegador. Logado, cada chamada vai para
  // /api/variable-expenses, que só enxerga as linhas do próprio usuário.

  const addDespesaVariavel = async (nomeBruto: string) => {
    const nome = nomeBruto.trim().replace(/\s+/g, ' ');
    if (!nome) throw new Error('Dê um nome para a despesa.');
    if (despesasVariaveis.some(d => d.nome.toLowerCase() === nome.toLowerCase())) {
      throw new Error(`Você já tem uma despesa chamada "${nome}".`);
    }

    if (user && !isGuest) {
      const res = await fetch('/api/variable-expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao criar a despesa');
      setDespesasVariaveis(prev => [...prev, data.despesa]);
    } else {
      if (despesasVariaveis.length >= 12) {
        throw new Error('Você já tem 12 despesas variáveis. Remova alguma para criar outra.');
      }
      setDespesasVariaveis(prev => [
        ...prev,
        { id: crypto.randomUUID(), nome, posicao: prev.length }
      ]);
    }
  };

  const renameDespesaVariavel = async (id: string, nomeBruto: string) => {
    const nome = nomeBruto.trim().replace(/\s+/g, ' ');
    if (!nome) throw new Error('Dê um nome para a despesa.');
    if (despesasVariaveis.some(d => d.id !== id && d.nome.toLowerCase() === nome.toLowerCase())) {
      throw new Error(`Você já tem uma despesa chamada "${nome}".`);
    }

    if (user && !isGuest) {
      const res = await fetch(`/api/variable-expenses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao renomear a despesa');
    }
    setDespesasVariaveis(prev => prev.map(d => (d.id === id ? { ...d, nome } : d)));
  };

  const removeDespesaVariavel = async (id: string) => {
    if (user && !isGuest) {
      const res = await fetch(`/api/variable-expenses/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro ao excluir a despesa');
    }
    // Os percentuais continuam gravados nos produtos de propósito: o motor de
    // preço só soma as despesas que ainda existem na lista, então a despesa sai
    // do preço na hora sem apagar o que a pessoa já tinha preenchido.
    setDespesasVariaveis(prev => prev.filter(d => d.id !== id));
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
      user, login, logout, isGuest, setGuestMode, freeModeEnabled, planosAtivos, salvarDocumentoEmpresa,
      custosFixos, setCustosFixos,
      produtos, setProdutos,
      saveProduto, removeProduto, syncProdutos,
      saveCustoFixo, removeCustoFixo,
      despesasVariaveis, addDespesaVariavel, renameDespesaVariavel, removeDespesaVariavel,
      estrategias, addEstrategia, updateEstrategia, removeEstrategia,
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
