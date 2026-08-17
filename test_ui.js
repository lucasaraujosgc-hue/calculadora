import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));

  await page.goto('http://localhost:3000/auth');
  
  // Login
  await page.type('input[type="email"]', 'lucasdocarbono@gmail.com');
  await page.type('input[type="password"]', '123456'); // assuming a password or just test account
  await page.click('button[type="submit"]');
  
  await page.waitForNavigation();
  
  // Go to Dashboard
  await page.goto('http://localhost:3000/');
  await page.waitForSelector('input[placeholder="Ex: 5000"]');
  
  // Type in the input
  await page.type('input[placeholder="Ex: 5000"]', '100');
  
  await new Promise(r => setTimeout(r, 2000));
  
  await browser.close();
})();
