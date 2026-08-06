const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target = `    // Run migrations on startup
    const { runMigrations } = await import("./src/db/migrate.js");
    await runMigrations();`;

const replacement = `    // Run migrations on startup
    const { runMigrations } = await import("./src/db/migrate.js");
    try {
      await runMigrations();
    } catch (err) {
      console.error("Falha crítica ao rodar as migrations do banco de dados. Encerrando o processo.", err);
      process.exit(1);
    }`;

const replaced = code.replace(target, replacement);
fs.writeFileSync('server.ts', replaced);
