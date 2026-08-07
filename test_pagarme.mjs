import fetch from "node-fetch"; // actually tsx/node18 uses global fetch
async function test() {
  const PAGARME_API_URL = 'https://sdx-api.pagar.me/core/v5';
  const PAGARME_SECRET_KEY = 'sk_test_xxxxxxxxxxxxxxxxxxxx';
  const orderCode = `PAY-1234`;
  const res = await fetch(`${PAGARME_API_URL}/paymentlinks`, {
    method: "POST",
    headers: {
      "Authorization": "Basic " + Buffer.from(`${PAGARME_SECRET_KEY}:`).toString("base64"),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      type: "order",
      name: "Pagamento Teste",
      order_code: orderCode,
      payment_settings: { 
        accepted_payment_methods: ["credit_card", "pix"],
        credit_card_settings: {
          operation_type: "auth_and_capture",
          installments: [{ number: 1, total: 1000 }]
        }
      },
      cart_settings: { items: [{ name: "Teste", amount: 1000, default_quantity: 1 }] }
    })
  });
  console.log("Status:", res.status);
  const text = await res.text();
  console.log("Response:", text);
}
test();
