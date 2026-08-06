const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target = `        } catch (dbErr) {
          console.error("Failed to query courses for meta tags:", dbErr);
        }`;

const replacement = `        } catch (dbErr: any) {
          if (dbErr.code !== '42P01') {
            console.error("Failed to query courses for meta tags:", dbErr);
          }
        }`;

code = code.replace(target, replacement);
fs.writeFileSync('server.ts', code);
