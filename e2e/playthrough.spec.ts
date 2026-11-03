import { test, expect, type Page } from '@playwright/test';

const shot = (page: Page, name: string) => page.screenshot({ path: `screenshots/${test.info().project.name}-${name}.png`, fullPage: false });

async function noHorizontalScroll(page: Page) {
  const [sw, vw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(sw, 'page must not scroll sideways').toBeLessThanOrEqual(vw);
}

async function closeReader(page: Page) {
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
}

async function read(page: Page, id: string, pin = true) {
  await page.locator(`[data-doc="${id}"]`).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  if (pin) {
    const pinAll = dialog.getByRole('button', { name: 'Pin all' });
    if (await pinAll.count()) await pinAll.click();
  }
}

async function showAndAsk(page: Page, docTitle: string, question: string) {
  await page.getByRole('button', { name: /Show document/ }).click();
  await page.getByRole('option', { name: docTitle, exact: true }).click();
  await page.getByLabel('Your question').fill(question);
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Ask', exact: true })).toBeVisible();
}

test('solve The Karalis File by clicking', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/');
  await page.getByRole('button', { name: /The Karalis File/ }).click();
  await shot(page, '01-folder');
  await page.getByRole('button', { name: 'Untie the twine' }).click();
  await page.getByRole('button', { name: 'Go to the desk' }).click();
  await expect(page.getByRole('heading', { name: /Police file, 1952/ })).toBeVisible();
  await noHorizontalScroll(page);
  await shot(page, '02-desk');

  // read the key records and pin their facts
  for (const id of ['review-brief', 'stmt-aris', 'stmt-ferrante', 'stmt-laila', 'stmt-cafe', 'cafe-orders', 'autopsy-1952',
    'watchman-notebook', 'club-register', 'charcoal-daybook', 'hospital-register', 'union-minutes', 'newspaper-union',
    'pharmacy-register', 'patient-card', 'bank-letter', 'handwriting-comparison', 'tox-2024']) {
    await read(page, id);
    if (id === 'watchman-notebook') {
      await page.getByRole('button', { name: /Show translation/ }).click();
      await expect(page.getByText('8.05 An effendi in a grey overcoat went up.')).toBeVisible();
      await shot(page, '03-watchman');
    }
    await closeReader(page);
  }

  // street photograph with the magnifier
  await read(page, 'street-photo');
  await page.getByRole('button', { name: /Magnifier/ }).click();
  await expect(page.getByTestId('magnifier')).toBeVisible();
  await page.locator('.photo-frame').focus();
  for (let i = 0; i < 9; i++) await page.keyboard.press('ArrowRight');
  for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowDown');
  await shot(page, '04-magnifier');
  await closeReader(page);

  // QR sticker unlocks the motor registry
  await expect(page.locator('[data-doc="vehicle-registry"]')).toHaveCount(0);
  await read(page, 'qr-traffic');
  await page.getByRole('button', { name: 'Scan the QR code' }).click();
  await expect(page.getByText('RECORD RETRIEVED')).toBeVisible();
  await page.getByRole('button', { name: /Open: Digitised motor registry/ }).click();
  await expect(page.getByRole('cell', { name: 'Aristidis Manos' })).toBeVisible();
  await closeReader(page);
  await expect(page.locator('[data-doc="vehicle-registry"]')).toHaveCount(1);

  // sealed letter
  await read(page, 'sealed-letter');
  await page.getByRole('button', { name: 'Break the wax seal' }).click();
  await page.getByRole('button', { name: /Show translation/ }).click();
  await expect(page.getByText('I will see him tonight at eight at the office.', { exact: false })).toBeVisible();
  await shot(page, '05-letter');
  await closeReader(page);

  // timeline shows collisions
  await page.getByRole('link', { name: /Timeline/ }).click();
  const coll = page.getByRole('region', { name: 'Statements that collide with the record' });
  await expect(coll).toBeVisible();
  await expect(coll).toContainText('Claims: at the club all evening');
  await expect(coll).toContainText('Claims: brief social visit');
  await expect(coll).toContainText('Claims: at home with her mother');
  await noHorizontalScroll(page);
  await shot(page, '06-timeline');
  // clicking a bar opens its source
  await page.locator('.tl-bar.kind-absence').first().click();
  await expect(page.getByRole('dialog')).toContainText('Registre des entrées et sorties');
  await closeReader(page);

  // interrogate Aris until he breaks
  await page.getByRole('link', { name: /Interview/ }).click();
  await page.getByRole('button', { name: /Aris Manos/ }).click();
  await page.getByRole('button', { name: 'Where were you on the evening of 10 January?' }).click();
  await expect(page.locator('.line.a').last()).toContainText('Cercle des Négociants');
  await showAndAsk(page, 'Cercle des Négociants: members\' register', 'Explain this signature at 19.55.');
  await expect(page.locator('.caught-stamp')).toHaveCount(1);
  await showAndAsk(page, "Charcoal seller's day-book", 'And this?');
  await showAndAsk(page, 'Pharmacy poisons register', 'Who collected these?');
  await expect(page.locator('.caught-stamp')).toHaveCount(3);
  await expect(page.getByText('CONFESSION RECORDED', { exact: true })).toHaveCount(0);
  await showAndAsk(page, 'Toxicology re-reading, 2024', 'Veronal killed him, not smoke.');
  await expect(page.getByText('CONFESSION RECORDED', { exact: true })).toBeVisible();
  await noHorizontalScroll(page);
  await shot(page, '07-interview');

  // notes carry the caught cards and the transcript
  await page.getByRole('link', { name: /Notes/ }).click();
  await expect(page.locator('.note-card.caught').first()).toContainText('Aris');
  await page.getByLabel('Notepad').fill('Aris left the club at 19.55. Brazier bought at 21.05.');
  await page.getByText(/Aris Manos \(\d+ questions/).click();
  await shot(page, '08-notes');

  // one hint
  await page.getByRole('link', { name: /Hints/ }).click();
  await page.getByRole('button', { name: /Reveal hint 1 of 3/ }).first().click();
  await expect(page.getByText('Used: 1')).toBeVisible();

  // wrong charge first: Ferrante
  await page.getByRole('link', { name: /Charge/ }).click();
  await page.getByText('Dr Giulio Ferrante').first().click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByText('Veronal in his coffee, then a brazier staged').click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByText('To escape a debt of 400 pounds').click();
  await page.getByRole('button', { name: 'Next' }).click();
  for (const t of ['Watchman\'s notebook', 'Toxicology re-reading, 2024', 'Statement: Dr Giulio Ferrante']) await page.getByLabel(t, { exact: true }).check();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'File the charge' }).click();
  await expect(page.getByRole('alert')).toContainText('Hospital of St Andrew');
  await shot(page, '09-refused');
  await page.getByRole('button', { name: 'Reconsider the charge' }).click();

  // correct charge
  await page.getByText('Aris Manos').first().click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByText('Veronal in his coffee, then a brazier staged').click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByText('To stop him exposing forged warehouse receipts').click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('Toxicology re-reading, 2024', { exact: true }).uncheck();
  await page.getByLabel('Watchman\'s notebook', { exact: true }).uncheck();
  await page.getByLabel('Statement: Dr Giulio Ferrante', { exact: true }).uncheck();
  for (const t of ['Cercle des Négociants: members\' register', "Charcoal seller's day-book", 'Toxicology re-reading, 2024']) await page.getByLabel(t, { exact: true }).check();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'File the charge' }).click();
  await expect(page.getByTestId('rank')).toHaveText('Chief Inspector');
  await expect(page.getByTestId('score-total')).toHaveText('93');
  await page.getByRole('button', { name: 'Unseal the solution memo' }).click();
  await expect(page.getByText('SOLUTION MEMO, REF 52/117')).toBeVisible();
  await noHorizontalScroll(page);
  await shot(page, '10-verdict');

  // progress survives a reload (persisted per case)
  await page.reload();
  await expect(page.getByTestId('rank')).toHaveText('Chief Inspector');
});

test('the browser never receives secret.json', async ({ page, request }) => {
  const res = await request.get('/api/cases/karalis');
  const body = await res.text();
  expect(body).not.toContain('culprit');
  expect(body).not.toContain('solutionMemo');
  expect((await request.get('/case-assets/karalis/secret.json')).status()).toBe(404);
  expect((await request.get('/case-assets/karalis/..%2Fsecret.json')).status()).toBe(400);
  void page;
});

test('give up reveals the memo without a rank', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/#/case/karalis/intro');
  await page.getByRole('button', { name: 'Untie the twine' }).click();
  await page.getByRole('button', { name: 'Go to the desk' }).click();
  await page.getByRole('link', { name: /Charge/ }).click();
  await page.getByRole('button', { name: 'Give up and read the solution' }).click();
  await page.getByRole('button', { name: 'Yes, show the solution' }).click();
  await expect(page.getByText('You gave up the case')).toBeVisible();
  await expect(page.getByTestId('rank')).toHaveCount(0);
});

async function selectText(page: Page, phrase: string) {
  await page.evaluate((p) => {
    const art = document.querySelector('.reader article')!;
    const w = document.createTreeWalker(art, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const i = (n as Text).data.indexOf(p);
      if (i >= 0) {
        const r = document.createRange();
        r.setStart(n, i); r.setEnd(n, i + p.length);
        const sel = window.getSelection()!;
        sel.removeAllRanges(); sel.addRange(r);
        return;
      }
    }
    throw new Error('phrase not found: ' + p);
  }, phrase);
}

test('highlight passages, add notes and find them again', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/#/case/karalis/intro');
  await page.getByRole('button', { name: 'Untie the twine' }).click();
  await page.getByRole('button', { name: 'Go to the desk' }).click();

  // plain yellow highlight
  await read(page, 'club-register', false);
  await selectText(page, '19.55');
  await page.getByRole('button', { name: 'Highlight in yellow' }).click();
  await expect(page.getByRole('region', { name: 'Your marks on this document' })).toContainText('"19.55"');
  await closeReader(page);

  // highlight with a note, inside a translation
  await read(page, 'watchman-notebook', false);
  await page.getByRole('button', { name: /Show translation/ }).click();
  await selectText(page, 'An effendi in a grey overcoat went up');
  await page.getByRole('button', { name: 'Highlight + note' }).click();
  await page.getByLabel('Note for the highlighted passage').fill('Aris at the office at 8.05, while he claims the club');
  await page.getByRole('button', { name: 'Pink highlight' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.mark-item.c-pink')).toContainText('grey overcoat');
  await shot(page, '11-highlight-reader');
  // a note on the whole document still works
  await page.getByRole('button', { name: 'Add note' }).click();
  await page.getByLabel('Note about this document').fill('Never collected by the police in 1952');
  await page.getByRole('button', { name: 'Save note' }).click();
  await closeReader(page);

  // the Notes screen collects everything, grouped by document
  await page.getByRole('link', { name: /Notes/ }).click();
  const marks = page.getByRole('region', { name: /Highlights and notes/ });
  await expect(marks.getByRole('button', { name: "Watchman's notebook" })).toBeVisible();
  await expect(marks.getByRole('button', { name: /Cercle des Négociants/ })).toBeVisible();
  await expect(marks).toContainText('Aris at the office at 8.05');
  await expect(marks).toContainText('Never collected by the police in 1952');
  await shot(page, '12-highlights-notes');
  await page.getByLabel('Search highlights and notes').fill('overcoat');
  await expect(marks.locator('.mark-item')).toHaveCount(1);
  // edit the note
  await marks.getByRole('button', { name: 'Edit note' }).click();
  await marks.getByLabel('Note', { exact: true }).fill('Aris went up at 8.05. Club alibi broken.');
  await marks.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(marks).toContainText('Club alibi broken');
  // jump back into the document
  await marks.getByRole('button', { name: 'Show in document' }).click();
  await expect(page.getByRole('dialog')).toContainText("Watchman's notebook");
  await closeReader(page);

  // survives a reload
  await page.reload();
  await page.getByLabel('Search highlights and notes').fill('');
  await expect(page.getByRole('region', { name: /Highlights and notes/ }).locator('.mark-item')).toHaveCount(3);
  await expect(page.getByRole('link', { name: /Notes/ })).toContainText('3');
  await noHorizontalScroll(page);
});

test('interview craft, pressure, the hypothesis board and the debrief', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/#/case/karalis/intro');
  await page.getByRole('button', { name: 'Untie the twine' }).click();
  await page.getByText('Detective mode', { exact: true }).click();
  await page.getByRole('button', { name: 'Go to the desk' }).click();
  await expect(page.getByText('DETECTIVE MODE')).toBeVisible();
  for (const id of ['club-register', 'union-minutes', 'hospital-register', 'charcoal-daybook', 'pharmacy-register', 'tox-2024', 'stmt-aris', 'watchman-notebook']) { await read(page, id); await closeReader(page); }

  // hints are sealed in detective mode
  await page.getByRole('link', { name: /Hints/ }).click();
  await expect(page.getByText(/Detective mode: there is no file/)).toBeVisible();

  // bullying an innocent witness produces an unreliable admission
  await page.getByRole('link', { name: /Interview/ }).click();
  await page.getByRole('button', { name: /Laila Sabry/ }).click();
  await expect(page.locator('.chips')).toHaveCount(0);
  for (let i = 0; i < 3; i++) {
    await page.getByLabel('Your question').fill('Admit it, you killed him or you will hang.');
    await page.getByRole('button', { name: 'Ask', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Ask', exact: true })).toBeVisible();
  }
  await expect(page.locator('.tech-coercive')).toHaveCount(3);
  await expect(page.getByText('OBTAINED UNDER PRESSURE')).toBeVisible();
  await shot(page, '13-pressure');

  // commit Aris to his alibi, then show the register: locked in
  await page.getByRole('button', { name: /All witnesses/ }).click();
  await page.getByRole('button', { name: /Aris Manos/ }).click();
  await page.getByLabel('Your question').fill('Tell me where you were on the evening of 10 January.');
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  await expect(page.locator('.tech-open')).toHaveCount(1);
  await showAndAsk(page, "Cercle des Négociants: members' register", 'Then explain this.');
  await expect(page.locator('.caught-stamp').first()).toContainText('LOCKED IN');

  // hypothesis board
  await page.getByRole('link', { name: /Board/ }).click();
  const row = page.getByRole('row', { name: /Hospital admissions register/ });
  await row.getByRole('button', { name: /against Dr Giulio Ferrante/ }).click(); // C
  await row.getByRole('button', { name: /against Dr Giulio Ferrante/ }).click(); // I
  await expect(row.getByRole('button', { name: /against Dr Giulio Ferrante: inconsistent/ })).toBeVisible();
  await page.getByRole('row', { name: /Cercle des/ }).getByRole('button', { name: /against Aris Manos/ }).click();
  await expect(page.getByText(/No theory stands out yet/)).toBeVisible();
  const mark = async (rowName: RegExp, who: RegExp, times: number) => { for (let i = 0; i < times; i++) await page.getByRole('row', { name: rowName }).getByRole('button', { name: who }).click(); };
  await mark(/minutes and attendance/, /against Laila Sabry/, 2);
  await mark(/Toxicology/, /against No one/, 2);
  await expect(page.getByText(/Fewest inconsistencies/)).toContainText('Aris Manos');
  await noHorizontalScroll(page);
  await shot(page, '14-board');

  // charge and read the profile
  await page.getByRole('link', { name: /Charge/ }).click();
  await page.getByText('Aris Manos').first().click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByText('He lit a brazier himself').click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByText('To stop him exposing forged warehouse receipts').click();
  await page.getByRole('button', { name: 'Next' }).click();
  for (const t of ["Cercle des Négociants: members' register", "Charcoal seller's day-book", 'Toxicology re-reading, 2024']) await page.getByLabel(t, { exact: true }).check();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'File the charge' }).click();
  const profile = page.getByRole('region', { name: 'Investigator profile' });
  await expect(profile).toContainText('Timing of evidence');
  await expect(profile).toContainText('unreliable admission');
  await expect(profile.locator('.finding', { hasText: 'Anchoring' })).toContainText('Watch this');
  await shot(page, '15-debrief');
});
