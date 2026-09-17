/**
 * Browser: B→A opens defense QTE; LMB dodge / skip via Esc.
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
  await page.getByRole('button', { name: /^B → A Attack/ }).waitFor({
    timeout: 10000,
  });

  await page.getByRole('button', { name: /^B → A Attack/ }).click();
  const dialog = page.getByRole('dialog', { name: /Defense timing/i });
  await dialog.waitFor({ timeout: 8000 });
  console.log('Defense QTE open');

  const hint = await dialog
    .locator('text=/LMB \\/ Space = dodge/i')
    .first()
    .textContent();
  console.log('Hint:', hint);
  assert(hint && /RMB/i.test(hint), 'expected LMB/RMB hint inside QTE');

  // Left-click mid-collapse
  await page.waitForTimeout(450);
  await page.locator('[aria-label="Defense timing"]').click({ button: 'left' });
  await page.waitForTimeout(1200); // result hold

  const body = await page.locator('body').innerText();
  const success = /dodges \(precise|dodges \(sloppy/i.test(body);
  const fail = /mistimes defense|hit lands/i.test(body);
  console.log('LMB result success?', success, 'fail?', fail);
  assert(success || fail, 'expected dodge success or fail log');

  // Esc / cancel path
  await page.getByRole('button', { name: /^B → A Attack/ }).click();
  await page.getByRole('dialog', { name: /Defense timing/i }).waitFor();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const body2 = await page.locator('body').innerText();
  assert(
    /taking the hit|mistimes defense|hit lands|cancelled/i.test(body2),
    'cancel should take the hit'
  );
  console.log('Cancel OK');

  console.log('PLAYER DEFENSE UI OK');
} finally {
  await browser.close();
}
