const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminPanel.tsx', 'utf8');

// Replace value="" with value="free" in the select option
code = code.replace('<option value="">Sem Plano</option>', '<option value="free">Sem Plano / Básico</option>');

// Also update the select onChange if it checks for ''
// Oh wait, in server.ts the fix_admin_users.cjs script replaced 'free' with '':
// `plan: u.planId === 'free' ? '' : u.planId,`
// Let me revert that part in server.ts to return 'free' instead of '', because it's better to just use 'free'.
