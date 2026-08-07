const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
`    // Admin login
    require('fs').appendFileSync('debug.log', JSON.stringify({ email, pass: password, ADMIN_EMAIL: process.env.ADMIN_EMAIL, ADMIN_PASS: process.env.ADMIN_PASSWORD }) + '\\n');`,
`    // Admin login
    fs.appendFileSync('debug.log', JSON.stringify({ email, pass: password, ADMIN_EMAIL: process.env.ADMIN_EMAIL, ADMIN_PASS: process.env.ADMIN_PASSWORD }) + '\\n');`
);
code = code.replace(
`    const msgs = err.errors ? err.errors.map((e: any) => e.message).join(', ') : "Dados inválidos";`,
`    fs.appendFileSync('debug.log', 'Error: ' + err.stack + '\\n');
    const msgs = err.errors ? err.errors.map((e: any) => e.message).join(', ') : "Dados inválidos";`
);

fs.writeFileSync('server.ts', code);
