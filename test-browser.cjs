const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Capturar todos los logs de la consola
  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('ERROR:', err.message));
  page.on('requestfailed', req => console.log('FAILED:', req.url(), req.failure()));
  
  console.log('=== Navegando a la app ===');
  await page.goto('https://cleansahel.onrender.com', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  // Login
  console.log('\n=== Haciendo login ===');
  await page.fill('input[type="text"], input[placeholder*="suario"]', 'admin');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  
  // Ver qué dice la app
  const html = await page.content();
  console.log('\n=== Contenido de la página tras login (extracto) ===');
  const text = await page.evaluate(() => document.body.innerText);
  console.log(text.substring(0, 1500));
  
  // Ver el localStorage
  const ls = await page.evaluate(() => {
    return {
      token: localStorage.getItem('cleanerp-token')?.substring(0, 50),
      user: localStorage.getItem('cleanerp-user'),
      demoData: localStorage.getItem('cleanerp-demo-data-v1')?.substring(0, 100)
    };
  });
  console.log('\n=== LocalStorage ===');
  console.log(JSON.stringify(ls, null, 2));
  
  // Ver si hay banner de error
  const errorText = await page.evaluate(() => {
    const errorEl = document.querySelector('[class*="red-600"], [class*="bg-red"]');
    return errorEl?.textContent;
  });
  console.log('\n=== Banner de error ===');
  console.log(errorText || 'ninguno');
  
  // Hacer una captura
  await page.screenshot({ path: '/tmp/screen.png', fullPage: true });
  console.log('\n=== Captura guardada en /tmp/screen.png ===');
  
  await browser.close();
})().catch(e => console.error('FATAL:', e));
