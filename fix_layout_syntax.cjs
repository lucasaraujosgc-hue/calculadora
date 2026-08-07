const fs = require('fs');
let code = fs.readFileSync('src/components/Layout.tsx', 'utf8');

const targetProfile = `             {!isCollapsed && <span>Sair</span>}
          </div>
        ) : (`

const replacementProfile = `             {!isCollapsed && <span>Sair</span>}
          </div>
          </div>
        ) : (`

code = code.replace(targetProfile, replacementProfile);
fs.writeFileSync('src/components/Layout.tsx', code);
