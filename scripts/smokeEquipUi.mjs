/**
 * Browser smoke for equip UI surfaces.
 * Run: node scripts/smokeEquipUi.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:1420';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

try {
  // --- LewdLab gear strip ---
  await page.goto(`${BASE}/lewd`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: /Recipient gear/i }).waitFor({ timeout: 10000 });
  const peelTorso = page.getByRole('button', { name: 'Peel torso' });
  await peelTorso.click();
  await page.waitForTimeout(200);
  const logText = await page.locator('text=/Peeled torso/i').first().textContent();
  console.log('LewdLab peel log:', logText?.slice(0, 120));
  assert(logText && /Peeled torso/i.test(logText), 'expected peel log');

  // Barrier preview on a channel targeting nipple should show bare / low after peel
  // Ensure a channel exists; set target to nipple if available
  const targetSelects = page.locator('label:has-text("Target") select');
  if ((await targetSelects.count()) > 0) {
    const opts = await targetSelects.first().locator('option').allTextContents();
    if (opts.includes('nipple')) {
      await targetSelects.first().selectOption('nipple');
      await page.waitForTimeout(100);
      const barrier = await page.locator('text=/Access .* barrier soft/i').first().textContent();
      console.log('Barrier after peel:', barrier);
      assert(
        barrier && (/bare/i.test(barrier) || /soft 0%/i.test(barrier)),
        'expected bare/0% soft barrier after torso peel'
      );
    }
  }

  await page.getByRole('button', { name: 'Re-equip all owned' }).click();
  await page.waitForTimeout(200);
  const reLog = await page.locator('text=/Re-equipped/i').first().textContent();
  console.log('LewdLab re-equip:', reLog?.slice(0, 80));
  assert(reLog && /Re-equipped/i.test(reLog), 'expected re-equip log');

  // --- Social bathe ---
  await page.goto(`${BASE}/social`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Bathe\s*chore/i }).click();
  await page.getByRole('button', { name: 'Run task' }).click();
  await page.waitForTimeout(300);
  const batheLog = page.locator('text=/peels for bath/i').first();
  await batheLog.waitFor({ timeout: 8000 });
  console.log('Social bathe:', (await batheLog.textContent())?.slice(0, 120));

  // --- Battleground discard ---
  await page.goto(`${BASE}/battleground`, { waitUntil: 'networkidle' });
  await page.locator('text=LOADOUT').first().waitFor({ timeout: 8000 });
  const ruinBtn = page.getByRole('button', { name: /Lab: ruin armor/i });
  await ruinBtn.click();
  await page.waitForTimeout(200);
  const discardBtn = page.getByRole('button', { name: 'Discard' }).first();
  await discardBtn.waitFor({ timeout: 5000 });
  await discardBtn.click();
  await page.waitForTimeout(200);
  const discardLog = page.locator('text=/discards ruined/i').first();
  await discardLog.waitFor({ timeout: 5000 });
  console.log('Battleground discard:', (await discardLog.textContent())?.slice(0, 120));

  console.log('UI OK');
} finally {
  await browser.close();
}
