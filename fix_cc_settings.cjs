const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target = `      payment_settings: { 
        accepted_payment_methods: ["credit_card", "pix"],
        pix_settings: { expires_in: 3600 }
      },`;

const replacement = `      payment_settings: { 
        accepted_payment_methods: ["credit_card", "pix"],
        pix_settings: { expires_in: 3600 },
        credit_card_settings: {
          operation_type: "auth_and_capture",
          installments: [{ number: 1, total: plan.priceCents }]
        }
      },`;

code = code.replace(target, replacement);

fs.writeFileSync('server.ts', code);
