const fs = require('fs');
let code = fs.readFileSync('.env.example', 'utf8');

code = code.replace(
  'ADMIN_EMAIL=admin@virgulacontabil.com.br',
  'ADMIN_EMAIL=admin@virgulacontabil.com.br\nADMIN_PASSWORD=senha-super-secreta-admin'
);

fs.writeFileSync('.env.example', code);
