const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const jwtValidation = `
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET não configurado. Defina a variável de ambiente JWT_SECRET.");
}
`;

code = code.replace('dotenv.config();', jwtValidation);
code = code.replace(/process\.env\.JWT_SECRET\s*\|\|\s*"default-secret"/g, 'JWT_SECRET');

fs.writeFileSync('server.ts', code);
