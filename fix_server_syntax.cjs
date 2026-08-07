const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(/if \(!planId \|\| !\(planId in PLANS\) && planId !==.*?\)/g, 'if (!planId || (!(planId in PLANS) && planId !== "" && planId !== "free"))');

fs.writeFileSync('server.ts', code);
