import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Capture page errors
  page.on('pageerror', error => {
    console.log('PAGE ERROR:', error.message);
    console.log(error.stack);
  });
  
  // Capture console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('CONSOLE ERROR:', msg.text());
    }
  });

  try {
    await page.goto('http://localhost:5173/live', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 5000));
    
    const errorText = await page.evaluate(() => {
      const overlay = document.querySelector('vite-error-overlay');
      return overlay ? overlay.shadowRoot.innerHTML : null;
    });
    
    if (errorText) {
      console.log('VITE ERROR OVERLAY DETECTED!');
      console.log(errorText.substring(0, 1000)); 
    } else {
      console.log('No Vite error overlay found.');
    }
    
  } catch (err) {
    console.error('PUPPETEER ERROR:', err);
  } finally {
    await browser.close();
  }
})();
