const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace('const app = express();', "const app = express();\napp.set('trust proxy', 1);");
fs.writeFileSync('server.ts', code);
