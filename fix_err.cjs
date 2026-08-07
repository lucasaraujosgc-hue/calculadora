const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(/const msgs = err\.errors \? err\.errors\.map\(\(e: any\) => e\.message\)\.join\(\', \'\) : "Dados inválidos";/g, 
`const msgs = err.errors ? err.errors.map((e: any) => e.message).join(', ') : (err.message || "Erro interno do servidor");`);

fs.writeFileSync('server.ts', code);
