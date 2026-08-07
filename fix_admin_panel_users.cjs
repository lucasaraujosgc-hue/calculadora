const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminPanel.tsx', 'utf8');

const targetHeader = `                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">E-mail</th>
                  <th className="px-4 py-3">Cargo</th>
                  <th className="px-4 py-3">Plano</th>
                  <th className="px-4 py-3">Data de Cadastro</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>`;
const replacementHeader = `                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">E-mail</th>
                  <th className="px-4 py-3">Telefone</th>
                  <th className="px-4 py-3">Cargo</th>
                  <th className="px-4 py-3">Plano</th>
                  <th className="px-4 py-3">Data de Cadastro</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>`;

const targetRow = `                  <tr key={i} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{u.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3">`;
const replacementRow = `                  <tr key={i} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{u.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.phone || '-'}</td>
                    <td className="px-4 py-3">`;

code = code.replace(targetHeader, replacementHeader);
code = code.replace(targetRow, replacementRow);

// Also fix colSpan
code = code.replace(/colSpan=\{6\}/g, "colSpan={7}");

fs.writeFileSync('src/pages/AdminPanel.tsx', code);
