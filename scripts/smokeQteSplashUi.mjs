/**
 * Browser: defense/attack QTE shows silhouette splash centered on aim.
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

  // Pick chest aim if needed, then B→A for defense splash on Fighter A (Amberyl F)
  await page.getByRole('button', { name: /^B → A Attack/ }).click();
  const dialog = page.getByRole('dialog', { name: /Defense timing/i });
  await dialog.waitFor({ timeout: 80000 });

  const img = dialog.locator('img[alt*="silhouette" i]');
  await img.waitFor({ timeout: 3000 });
  const src = await img.getAttribute('src');
  console.log('Splash src:', src);
  assert(src && /silhouette_(female|male)_front/i.test(src), 'expected silhouette art');

  const aimLabel = await dialog.locator('text=/Aim ·/i').textContent();
  console.log('Aim label:', aimLabel);
  assert(aimLabel && /Aim ·/i.test(aimLabel), 'expected aim zone label on splash');

  // Esc out
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // Attack rhythm ON → A→B should splash on B (Sain male)
  const toggle = page.getByRole('checkbox').filter({ hasText: /rhythm/i }).first();
  // Fallback: click label text
  const rhythmLabel = page.locator('label').filter({ hasText: /attack rhythm/i }).first();
  if (await rhythmLabel.count()) {
    const box = rhythmLabel.locator('input[type="checkbox"]');
    if (await box.count()) {
      const checked = await box.isChecked();
      if (!checked) await box.check();
    } else {
      await rhythmLabel.click();
    }
  }

  await page.getByRole('button', { name: /^A → B Attack/ }).click();
  const atkDialog = page.getByRole('dialog', { name: /Attack timing/i });
  await atkDialog.waitFor({ timeout: 8000 });
  const atkImg = atkDialog.locator('img[alt*="silhouette" i]');
  await atkImg.waitFor({ timeout: 3000 });
  const atkSrc = await atkImg.getAttribute('src');
  console.log('Attack splash src:', atkSrc);
  assert(
    atkSrc && /silhouette_male_front/i.test(atkSrc),
    'A→B on Sain should use male silhouette'
  );

  await page.keyboard.press('Escape');
  console.log('QTE SPLASH UI OK');
} finally {
  await browser.close();
}
