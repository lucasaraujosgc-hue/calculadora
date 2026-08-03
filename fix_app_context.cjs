const fs = require('fs');
let code = fs.readFileSync('src/context/AppContext.tsx', 'utf-8');

// We should modify the useEffect that loads data
// Instead of local storage for logged-in users, it should fetch from API

const loadDataOld = `  // Load user specific or guest data
  useEffect(() => {
    const suffix = user ? \`_\${user.email}\` : '';
    
    // Attempt to load from storage
    const savedCustos = localStorage.getItem(\`vc_custos\${suffix}\`) || sessionStorage.getItem(\`vc_custos\${suffix}\`);
    if (savedCustos) {
      setCustosFixos(JSON.parse(savedCustos));
    } else {
      setCustosFixos(user ? [] : [...defaultCustos]);
    }

    const savedProdutos = localStorage.getItem(\`vc_produtos\${suffix}\`) || sessionStorage.getItem(\`vc_produtos\${suffix}\`);
    if (savedProdutos) {
      setProdutos(JSON.parse(savedProdutos));
    } else {
      setProdutos(user ? [] : [...defaultProdutos]);
    }
  }, [user]);`;

const loadDataNew = `  // Load user specific or guest data
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
        setCustosFixos(JSON.parse(savedCustos));
      } else {
        setCustosFixos([...defaultCustos]);
      }

      const savedProdutos = localStorage.getItem('vc_produtos') || sessionStorage.getItem('vc_produtos');
      if (savedProdutos) {
        setProdutos(JSON.parse(savedProdutos));
      } else {
        setProdutos([...defaultProdutos]);
      }
    }
  }, [user, isGuest]);`;

code = code.replace(loadDataOld, loadDataNew);

const saveDataOld = `  // Save data when they change
  useEffect(() => {
    // Only save if data is loaded and not during an initial uninitialized state
    if (!custosFixos && !produtos) return;

    const suffix = user ? \`_\${user.email}\` : '';
    const storage = (user && localStorage.getItem('vc_user')) || (!user && localStorage.getItem('vc_custos')) ? localStorage : sessionStorage;
    
    storage.setItem(\`vc_custos\${suffix}\`, JSON.stringify(custosFixos));
    storage.setItem(\`vc_produtos\${suffix}\`, JSON.stringify(produtos));
  }, [custosFixos, produtos, user]);`;

const saveDataNew = `  // Save data when they change (only for guest)
  useEffect(() => {
    // Only save if data is loaded and not during an initial uninitialized state
    if (!custosFixos || !produtos) return;

    if (!user || isGuest) {
      const storage = localStorage.getItem('vc_custos') ? localStorage : sessionStorage;
      storage.setItem('vc_custos', JSON.stringify(custosFixos));
      storage.setItem('vc_produtos', JSON.stringify(produtos));
    }
  }, [custosFixos, produtos, user, isGuest]);`;

code = code.replace(saveDataOld, saveDataNew);

fs.writeFileSync('src/context/AppContext.tsx', code);
