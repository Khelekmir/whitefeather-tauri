/**
 * Browser smoke: CharacterDetail status wardrobe.
 * Run: node scripts/smokeWardrobeUi.mjs
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
  await page.getByRole('heading', { name: 'Wardrobe' }).waitFor({ timeout: 10000 });

  // Coverage should show tunic layers on chest before peel
  const chestBefore = page.locator('text=Chest (bra / slip / plate)').locator('..');
  const beforeText = await chestBefore.innerText();
  console.log('Chest coverage before:', beforeText.replace(/\s+/g, ' ').slice(0, 160));
  assert(/Linen|Slip|Tunic|Cloak/i.test(beforeText), 'expected clothing on chest before peel');

  await page.getByRole('button', { name: 'Peel torso' }).click();
  await page.waitForTimeout(150);
  const note = await page.locator('text=/Peeled torso/i').first().textContent();
  console.log('Peel note:', note);
  assert(note && /Peeled torso/i.test(note), 'peel note missing');

  const afterText = await chestBefore.innerText();
  console.log('Chest coverage after:', afterText.replace(/\s+/g, ' ').slice(0, 120));
  assert(/No covering layer/i.test(afterText), 'chest should be bare after peel');

  // Owned unequipped should list peeled pieces (exact name — not "Unequip")
  const ownedHeading = page.getByRole('heading', { name: /Owned · unequipped/i });
  await ownedHeading.waitFor();
  const equipBtns = page.getByRole('button', { name: 'Equip', exact: true });
  const equipCount = await equipBtns.count();
  console.log('Equip buttons:', equipCount);
  assert(equipCount >= 2, 'expected unequipped owned pieces');

  await equipBtns.first().click();
  await page.waitForTimeout(100);
  const eqNote = await page.getByTestId('wardrobe-note').textContent();
  console.log('Equip note:', eqNote);
  assert(eqNote && /^Equipped /i.test(eqNote), 'equip note missing');

  // Unequip one remaining equipped card
  const unequip = page.getByRole('button', { name: 'Unequip', exact: true }).first();
  await unequip.click();
  await page.waitForTimeout(100);
  const unNote = await page.getByTestId('wardrobe-note').textContent();
  console.log('Unequip note:', unNote);
  assert(unNote && /^Unequipped /i.test(unNote), 'unequip note missing');

  await page.getByRole('button', { name: 'Reset starter loadout' }).click();
  await page.waitForTimeout(100);
  const resetNote = await page.getByTestId('wardrobe-note').textContent();
  console.log('Reset note:', resetNote);
  assert(resetNote && /Reset to starter loadout/i.test(resetNote), 'reset note missing');

  const resetChest = await chestBefore.innerText();
  assert(
    !/No covering layer/i.test(resetChest),
    'chest should be covered again after reset'
  );

  // Switch character via picker — wardrobe should reload
  await page.getByRole('link', { name: 'Sain' }).click();
  await page.getByRole('heading', { name: 'Sain' }).waitFor({ timeout: 8000 });
  await page.getByRole('heading', { name: 'Wardrobe' }).waitFor();
  const sainSummary = await page
    .locator('text=/equipped ·/')
    .first()
    .textContent();
  console.log('Sain summary:', sainSummary);
  assert(sainSummary && /\d+ equipped/.test(sainSummary), 'sain wardrobe summary');

  console.log('WARDROBE UI OK');
} finally {
  await browser.close();
}
