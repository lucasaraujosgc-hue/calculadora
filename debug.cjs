const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
`    // Admin login
    console.log("Login attempt:", { email, pass: password, ADMIN_EMAIL: process.env.ADMIN_EMAIL, ADMIN_PASS: process.env.ADMIN_PASSWORD });`,
`    // Admin login
    require('fs').appendFileSync('debug.log', JSON.stringify({ email, pass: password, ADMIN_EMAIL: process.env.ADMIN_EMAIL, ADMIN_PASS: process.env.ADMIN_PASSWORD }) + '\\n');`
);

fs.writeFileSync('server.ts', code);
