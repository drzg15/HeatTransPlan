const puppeteer = require('puppeteer');

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080'] 
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  const drawAnnotation = async (selector, text, color, index = 0, pad = 0) => {
    await page.evaluate((sel, t, c, idx, p) => {
      const els = document.querySelectorAll(sel);
      if (els.length <= idx) return;
      const el = els[idx];
      const rect = el.getBoundingClientRect();
      const div = document.createElement('div');
      div.className = 'tutorial-annotation';
      div.style.position = 'absolute';
      div.style.left = (rect.left - p) + 'px';
      div.style.top = (rect.top + window.scrollY - p) + 'px';
      div.style.width = (rect.width + p*2) + 'px';
      div.style.height = (rect.height + p*2) + 'px';
      div.style.border = '4px solid ' + c;
      div.style.pointerEvents = 'none';
      div.style.zIndex = '9999';
      document.body.appendChild(div);

      const label = document.createElement('div');
      label.className = 'tutorial-annotation';
      label.style.position = 'absolute';
      label.style.left = (rect.left - p) + 'px';
      label.style.top = (rect.top + window.scrollY + rect.height + p) + 'px';
      label.style.backgroundColor = c;
      label.style.color = 'white';
      label.style.padding = '4px 8px';
      label.style.fontFamily = 'Arial';
      label.style.fontSize = '16px';
      label.style.pointerEvents = 'none';
      label.style.zIndex = '10000';
      label.innerText = t;
      document.body.appendChild(label);
    }, selector, text, color, index, pad);
  };

  const clearAnnotations = async () => {
    await page.evaluate(() => {
      document.querySelectorAll('.tutorial-annotation').forEach(el => el.remove());
    });
  };

  console.log('Navigating to Home...');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });

  console.log('Taking screenshot 0 (Overview)...');
  await page.screenshot({ path: '../frontend/public/tutorial_step0.png' });
  
  console.log('Clicking Load Example...');
  await page.waitForSelector('.btn-primary');
  await page.click('.btn-primary');

  // Wait for navigation to /data-collection
  console.log('Waiting for navigation to Data Collection...');
  await page.waitForNavigation({ waitUntil: 'networkidle0' });

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
  // Draw annotations for Step 1 (Add Process)
  await drawAnnotation('.pgl-group-card', "Add Process", "#8b5cf6", 0, 4);
  console.log('Taking screenshot 1 (Add Process)...');
  await page.screenshot({ path: '../frontend/public/tutorial_step1.png' });
  await clearAnnotations();

  // Draw annotations for Step 2 (Geolocation)
  await drawAnnotation('.leaflet-marker-pane', "Geolocation", "#8b5cf6", 0, 20);
  console.log('Taking screenshot 2 (Geolocation)...');
  await page.screenshot({ path: '../frontend/public/tutorial_step2.png' });
  await clearAnnotations();

  // Draw annotations for Step 3 (Subprocess Data)
  await drawAnnotation('.sp-body', "Add Subprocess Data", "#8b5cf6", 0, 4);
  console.log('Taking screenshot 3 (Subprocess Data)...');
  await page.screenshot({ path: '../frontend/public/tutorial_step3.png' });
  await clearAnnotations();

  console.log('Navigating to Potential Analysis...');
  await page.goto('http://localhost:5173/potential-analysis', { waitUntil: 'networkidle0' });
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Draw annotations for Step 4
  await drawAnnotation('.pa-panel', "Stream Summary & Selection", "#8b5cf6", 0, 4);

  console.log('Taking screenshot 4 (Stream Summary)...');
  await page.screenshot({ path: '../frontend/public/tutorial_step4.png' });
  await clearAnnotations();

  console.log('Taking screenshot 5 (Pinch Curves)...');
  // Scroll down to the curves
  await page.evaluate(() => {
    const el = document.querySelector('.pa-chart');
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
    else window.scrollBy(0, 300);
  });
  await new Promise(resolve => setTimeout(resolve, 500));
  
  await drawAnnotation('.pa-chart', "Heat Recovery Potential and Utilities", "#8b5cf6", 0, 4);
  await drawAnnotation('canvas', "Heat Recovery Potential and Utilities", "#8b5cf6", 0, 10); // fallback

  await page.screenshot({ path: '../frontend/public/tutorial_step5.png' });
  await clearAnnotations();

  console.log('Taking screenshot 6 (Heat Pumps)...');
  // Scroll down to heat pumps
  await page.evaluate(() => {
    const el = document.querySelector('.pa-hp-table-wrap') || document.querySelector('.heat-pump-table');
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
    else window.scrollTo(0, document.body.scrollHeight - 200);
  });
  await new Promise(resolve => setTimeout(resolve, 500));
  
  await drawAnnotation('.pa-hp-table-wrap', "Proposed Heat Pumps (Temp, kW, COP)", "#8b5cf6", 0, 4);

  await page.screenshot({ path: '../frontend/public/tutorial_step6.png' });

  console.log('Screenshots taken successfully.');
  await browser.close();
})();
