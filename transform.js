import fs from 'fs';

let code = fs.readFileSync('server.ts', 'utf-8');

// Replace usages but NOT definitions
const funcs = ['getUsers', 'saveUsers', 'getCourses', 'saveCourses', 'getLeads', 'saveLeads', 'getPayments', 'savePayments', 'getAllProducts', 'saveAllProducts', 'getUserRealProducts', 'seedSampleProducts'];

// To safely avoid definitions: we only replace if it's NOT preceded by "function "
funcs.forEach(func => {
  code = code.replace(new RegExp(`(?<!function\\s+)\\b${func}\\(`, 'g'), `await ${func}(`);
});

// Since we added await, we need to make sure the route handlers are async
// Find all app.get, app.post, app.put, app.delete
code = code.replace(/app\.(get|post|put|delete)\(([^,]+),\s*(?:requireAuth|requireUser|checkProductLimit),\s*(?:requireExcelImport,\s*)?(?:upload\.single\([^)]+\),\s*)?(async\s+)?\(req/g, (match, method, route, isAsync) => {
  if (isAsync) return match;
  return match.replace(/\(req/, 'async (req');
});

code = code.replace(/app\.(get|post|put|delete)\(([^,]+),\s*(async\s+)?\(req/g, (match, method, route, isAsync) => {
  if (isAsync) return match;
  return match.replace(/\(req/, 'async (req');
});

// Also replace checkProductLimit to be async
code = code.replace(/function checkProductLimit\(req/g, 'async function checkProductLimit(req');

fs.writeFileSync('server.ts.new', code);
