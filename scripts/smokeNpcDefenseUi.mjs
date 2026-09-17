/**
 * Browser: Battleground shows NPC defense % and can log dodge/parry.
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:1420';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

try {
  await page.goto(`${BASE}/battleground`, { waitUntil: 'domcontentloaded' });
  await page.locator('text=NPC defense').first().waitFor({ timeout: 10000 });
  const text = await page.locator('text=NPC defense').first().innerText();
  console.log('Defense line:', text);
  assert(/dodge \d+%/.test(text) && /parry \d+%/.test(text), 'dodge/parry % shown');

  // Spam attacks until we see a dodge or parry (or give up after N)
  let seen = false;
  for (let i = 0; i < 25; i++) {
    await page.getByRole('button', { name: /A → B Attack/ }).click();
    await page.waitForTimeout(80);
    const logBox = await page.locator('body').innerText();
    if (/dodges |parries /.test(logBox)) {
      seen = true;
      const line = logBox.match(/[^\n]*(dodges|parries)[^\n]*/);
      console.log('Defense event:', line?.[0]?.slice(0, 140));
      break;
    }
  }
  assert(seen, 'expected at least one dodge or parry in 25 attacks');
  console.log('NPC DEFENSE UI OK');
} finally {
  await browser.close();
}
