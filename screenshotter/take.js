const puppeteer = require('puppeteer');

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'] 
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  console.log('Navigating to Home...');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });

  console.log('Taking screenshot 0 (Overview)...');
  await page.screenshot({ path: '../frontend/public/tutorial_step0.png' });
  
  console.log('Clicking Load Example...');
  // Find the button that contains 'Example' or the specific text.
  // The button has text "home.load_example_1" but since we might be in English, let's select by class or just the button element.
  // Based on HomePage.tsx, it's the only btn-primary button in the left column.
  await page.waitForSelector('.btn-primary');
  await page.click('.btn-primary');

  // Wait for navigation to /data-collection
  console.log('Waiting for navigation to Data Collection...');
  await page.waitForNavigation({ waitUntil: 'networkidle0' });

  // Wait for map or elements to load
  await page.waitForSelector('.pgl-toggle');

  // Open the process group
  try {
    const toggles = await page.$$('.pgl-toggle');
    if (toggles.length > 0) {
      await toggles[0].click(); // Expand Group
      // Wait for the group body to render
      await page.waitForSelector('.pgl-group-body', { timeout: 3000 });
      
      // Now find the subprocess toggles inside the group body
      const subToggles = await page.$$('.sp-header .pgl-toggle');
      if (subToggles.length > 0) {
        await subToggles[0].click(); // Expand first Subprocess
        // Wait for the stream body to render
        await page.waitForSelector('.sp-body', { timeout: 3000 });
        await new Promise(resolve => setTimeout(resolve, 500)); // Just a little extra time for animations
      }
    }
  } catch (e) {
    console.log('Could not click toggles properly:', e);
  }

  console.log('Taking screenshot 1 (Data Collection)...');
  await page.screenshot({ path: '../frontend/public/tutorial_step1.png' });

  console.log('Navigating to Potential Analysis...');
  await page.goto('http://localhost:5173/potential-analysis', { waitUntil: 'networkidle0' });
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  console.log('Taking screenshot 2 (Stream Summary)...');
  await page.screenshot({ path: '../frontend/public/tutorial_step2.png' });

  console.log('Taking screenshot 3 (Pinch Curves)...');
  // Scroll down to the curves
  await page.evaluate(() => {
    window.scrollBy(0, 400);
  });
  await new Promise(resolve => setTimeout(resolve, 500));
  await page.screenshot({ path: '../frontend/public/tutorial_step3.png' });

  console.log('Taking screenshot 4 (Heat Pumps)...');
  // Scroll down to the bottom
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });
  await new Promise(resolve => setTimeout(resolve, 500));
  await page.screenshot({ path: '../frontend/public/tutorial_step4.png' });

  console.log('Screenshots taken successfully.');
  await browser.close();
})();
