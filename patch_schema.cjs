const fs = require('fs');
let code = fs.readFileSync('src/db/schema.ts', 'utf8');
code = code.replace(
  "resetTokenExpiresAt: timestamp('reset_token_expires_at'),",
  "resetTokenExpiresAt: timestamp('reset_token_expires_at'),\n  verificationToken: text('verification_token'),\n  isVerified: boolean('is_verified').default(false).notNull(),"
);
// Make sure boolean is imported
if (!code.includes("boolean(")) {
  code = code.replace(/text, /g, 'text, boolean, ');
}
fs.writeFileSync('src/db/schema.ts', code);
