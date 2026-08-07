const fs = require('fs');
let code = fs.readFileSync('src/components/Layout.tsx', 'utf8');

const targetProfile = `{user ? (
          <div 
            onClick={() => { logout(); setIsMobileMenuOpen(false); }}
            title={isCollapsed ? "Sair" : undefined}`;

const planMapCode = `
          const planNames: Record<string, string> = { basico: 'Básico', intermediario: 'Intermediário', ilimitado: 'Ilimitado', free: 'Sem Plano' };
          const planName = planNames[user.plan || 'free'] || 'Sem Plano';
`;

const replacementProfile = `{user ? (
          <div className="flex flex-col w-full">
            {!isCollapsed && (
              <div className="px-3 mb-4 flex items-center justify-between">
                <div className="flex flex-col overflow-hidden">
                  <span className="text-sm font-semibold truncate text-foreground">{user.name}</span>
                  <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                </div>
                <div title={\`Plano Atual: \${user.plan === 'ilimitado' ? 'Ilimitado' : user.plan === 'intermediario' ? 'Intermediário' : user.plan === 'basico' ? 'Básico' : 'Gratuito'}\`} className="ml-2 flex shrink-0 items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary">
                  <Star className={\`w-4 h-4 \${user.plan === 'ilimitado' || user.plan === 'intermediario' ? 'fill-current' : ''}\`} />
                </div>
              </div>
            )}
            <div 
              onClick={() => { logout(); setIsMobileMenuOpen(false); }}
              title={isCollapsed ? "Sair" : undefined}`;

code = code.replace(targetProfile, replacementProfile);

fs.writeFileSync('src/components/Layout.tsx', code);
