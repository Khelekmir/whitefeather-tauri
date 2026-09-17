/**
 * Browser smoke: CharacterDetail wound care + Battleground pass time heal.
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:1420';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });

try {
  await page.goto(`${BASE}/characters/detailed/unit_amberyl`, {
    waitUntil: 'domcontentloaded',
  });
  await page.getByRole('heading', { name: 'Itemized health' }).waitFor({
    timeout: 10000,
  });

  // Lab injure chestLeft row
  const chestRow = page.locator('tr', { has: page.locator('code', { hasText: 'chestLeft' }) });
  await chestRow.getByRole('button', { name: 'Lab injure' }).click();
  await page.waitForTimeout(100);
  let note = await page.getByTestId('wardrobe-note').textContent();
  console.log('Injure:', note);
  assert(/Lab injure/i.test(note ?? ''), 'injure note');

  await chestRow.getByRole('button', { name: 'Bandage' }).click();
  await page.waitForTimeout(80);
  note = await page.getByTestId('wardrobe-note').textContent();
  console.log('Bandage:', note);
  assert(/Bandage/i.test(note ?? ''), 'bandage note');
  await expectTag(chestRow, 'dressed');

  await chestRow.getByRole('button', { name: 'Vulnerary' }).click();
  await page.waitForTimeout(80);
  note = await page.getByTestId('wardrobe-note').textContent();
  console.log('Vulnerary:', note);
  assert(/Vulnerary/i.test(note ?? ''), 'vulnerary note');
  await expectTag(chestRow, 'vulnerary');

  // Battleground: injure via attack then pass time — just check buttons exist + pass logs heal if wounded
  await page.goto(`${BASE}/battleground`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Bandage A (priority)' }).waitFor({
    timeout: 8000,
  });
  await page.getByRole('button', { name: 'Vulnerary A (priority)' }).click();
  await page.waitForTimeout(100);
  const log = page.locator('text=/vulnerary →/i').first();
  await log.waitFor({ timeout: 5000 });
  console.log('BG vulnerary:', await log.textContent());

  console.log('WOUND CARE UI OK');
} finally {
  await browser.close();
}

async function expectTag(row, tag) {
  const text = await row.innerText();
  assert(new RegExp(tag, 'i').test(text), `expected tag ${tag} in row`);
}
