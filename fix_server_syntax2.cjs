const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(/if \(!planId \|\| \(!\(planId in PLANS\) && planId !== "" && planId !== "free"\)\) \{/, 'if (planId !== "" && planId !== "free" && !(planId in PLANS)) {');

fs.writeFileSync('server.ts', code);
