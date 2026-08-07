const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const targetEmail = `          html: \`<p>Olá, \${user.name}.</p><p>Clique no link abaixo para redefinir sua senha. Ele expira em 1 hora.</p><p><a href="\${resetLink}">\${resetLink}</a></p><p>Se você não solicitou isso, ignore este e-mail.</p>\`,`
const replacementEmail = `          html: \`
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; padding: 32px; background-color: #ffffff;">
          <h2 style="color: #2e3440; font-size: 24px; margin-bottom: 24px; text-align: center;">Redefinição de Senha</h2>
          <p style="color: #4c566a; font-size: 16px; line-height: 1.5; margin-bottom: 24px;">Olá, <strong>\${user.name}</strong>.</p>
          <p style="color: #4c566a; font-size: 16px; line-height: 1.5; margin-bottom: 32px;">Você solicitou a redefinição da sua senha. Clique no botão abaixo para criar uma nova senha (o link expira em 1 hora):</p>
          <div style="text-align: center; margin-bottom: 32px;">
            <a href="\${resetLink}" style="display: inline-block; background-color: #1a56db; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Redefinir Minha Senha</a>
          </div>
          <p style="color: #4c566a; font-size: 14px; line-height: 1.5; text-align: center; margin-bottom: 0;">Se você não solicitou isso, por favor, ignore este e-mail. Nenhuma alteração será feita na sua conta.</p>
        </div>\`,`;

code = code.replace(targetEmail, replacementEmail);

fs.writeFileSync('server.ts', code);
