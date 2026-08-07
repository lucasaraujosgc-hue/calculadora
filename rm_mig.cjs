const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(/const { runMigrations } = await import\("\.\/src\/db\/migrate\.js"\);\n\s*try \{\n\s*await runMigrations\(\);\n\s*\} catch \(migErr\) \{\n\s*console\.error\("Migration failed:", migErr\);\n\s*\}/g, '// no migrations');

fs.writeFileSync('server.ts', code);
