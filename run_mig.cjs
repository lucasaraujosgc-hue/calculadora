const { runMigrations } = require('./src/db/migrate.js');
runMigrations().then(() => console.log('done')).catch(console.error);
