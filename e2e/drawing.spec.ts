import { expect, test, type Page } from '@playwright/test';

async function startDrawing(page: Page) {
  await page.goto('/?fakeAi=1#/processen/nieuw');
  await page.getByRole('tab', { name: 'Tekenen' }).click();
  await page.getByRole('button', { name: 'Begin met tekenen' }).click();
  await expect(page.getByTestId('drawing-canvas')).toBeVisible();
}

async function addLane(page: Page, name: string) {
  await page.getByLabel('Nieuwe zwembaan').fill(name);
  await page.getByRole('button', { name: 'Toevoegen' }).click();
}

const selectedId = (page: Page) => page.locator('.react-flow__node-shape.selected').getAttribute('data-id');

async function quickAdd(page: Page, kind: string, key: string, text?: string) {
  await page.getByLabel('Snel toevoegen').selectOption(kind);
  await page.getByTestId('drawing-canvas').focus();
  await page.keyboard.press(key);
  if (text) {
    await page.keyboard.press('Enter');
    await page.keyboard.type(text);
    await page.keyboard.press('Enter');
  }
}

test('draws a process with a decision using only the keyboard, then confirms it', async ({ page }) => {
  await startDrawing(page);
  await addLane(page, 'Klantenservice');
  await page
    .getByRole('navigation', { name: 'Vormen' })
    .getByRole('button', { name: 'Start', exact: true })
    .click();
  await quickAdd(page, 'task', 'Alt+ArrowRight', 'Aanvraag ontvangen');
  await quickAdd(page, 'decision', 'Alt+ArrowRight', 'Compleet?');
  const decision = await selectedId(page);
  await quickAdd(page, 'task', 'Alt+ArrowRight', 'Beoordelen');
  await quickAdd(page, 'end', 'Alt+ArrowRight');
  // Back to the decision with Tab, then the "no" path downwards and on to the end.
  for (let i = 0; i < 10 && (await selectedId(page)) !== decision; i++) await page.keyboard.press('Tab');
  await quickAdd(page, 'task', 'Alt+ArrowDown', 'Gegevens opvragen');
  await expect(page.getByTestId('validation-issues')).toContainText('1 fout(en)');

  // Connect "Gegevens opvragen" to the end without dragging: button, then click the target.
  await page.getByRole('button', { name: /Verbinden met/ }).click();
  await page.locator('.react-flow__node-shape', { hasText: 'Einde' }).click();
  await expect(page.getByTestId('validation-issues')).toContainText('Geen fouten');

  await page.getByRole('button', { name: 'Bevestigen' }).click();
  await expect(page.getByText('versie 1')).toBeVisible();
  await expect(page.locator('.react-flow__node-shape')).toHaveCount(6);
});

test('mouse: drop from the palette, drag into another lane, connect by dragging, undo', async ({ page }) => {
  await startDrawing(page);
  await addLane(page, 'Klantenservice');
  await addLane(page, 'Backoffice');
  const canvas = page.getByTestId('drawing-canvas');
  const canvasBox = (await canvas.boundingBox())!;
  const ks = (await page.getByRole('button', { name: 'Zwembaan Klantenservice' }).boundingBox())!;
  const bo = (await page.getByRole('button', { name: 'Zwembaan Backoffice' }).boundingBox())!;

  // Drag a task from the palette into the first lane.
  await page
    .getByRole('navigation', { name: 'Vormen' })
    .getByRole('button', { name: 'Taak', exact: true })
    .dragTo(canvas, {
      targetPosition: { x: ks.x + ks.width + 150 - canvasBox.x, y: ks.y + ks.height / 2 - canvasBox.y },
    });
  await expect(page.locator('.react-flow__node-shape')).toHaveCount(1);
  await page
    .getByRole('navigation', { name: 'Vormen' })
    .getByRole('button', { name: 'Taak', exact: true })
    .click();
  await expect(page.locator('.react-flow__node-shape')).toHaveCount(2);

  // The first task's role follows its lane; drag it down into the next lane.
  const first = page.locator('.react-flow__node-shape').first();
  await first.click();
  await expect(page.getByText(/^Rol:/)).toContainText('Klantenservice');
  const fb = (await first.boundingBox())!;
  const dy = bo.y + bo.height / 2 - (ks.y + ks.height / 2);
  await page.mouse.move(fb.x + fb.width / 2, fb.y + fb.height / 2);
  await page.mouse.down();
  await page.mouse.move(fb.x + fb.width / 2 + 5, fb.y + fb.height / 2 + dy / 2, { steps: 5 });
  await page.mouse.move(fb.x + fb.width / 2 + 10, fb.y + fb.height / 2 + dy, { steps: 5 });
  await page.mouse.up();
  await first.click();
  await expect(page.getByText(/^Rol:/)).toContainText('Backoffice');

  // Connect by dragging from the right handle of one shape onto the body of the other.
  const nodes = page.locator('.react-flow__node-shape');
  await nodes.nth(0).hover();
  const handle = nodes.nth(0).locator('.react-flow__handle-right');
  const target = (await nodes.nth(1).boundingBox())!;
  const hb = (await handle.boundingBox())!;
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 10 });
  await page.mouse.up();
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);

  // Undo removes the line again.
  await canvas.focus();
  await page.keyboard.press('Control+z');
  await expect(page.locator('.react-flow__edge')).toHaveCount(0);
});

test('autosaves a draft that can be continued from the process list', async ({ page }) => {
  await startDrawing(page);
  await page.getByLabel('Naam').fill('Mijn concept');
  await page
    .getByRole('navigation', { name: 'Vormen' })
    .getByRole('button', { name: 'Start', exact: true })
    .click();
  await quickAdd(page, 'task', 'Alt+ArrowRight', 'Eerste stap');
  await page.waitForTimeout(2000);
  await page.getByRole('link', { name: 'Processen', exact: true }).click();
  await expect(page.getByText('Concepten (nog niet bevestigd)')).toBeVisible();
  await page.getByRole('button', { name: 'Verder tekenen' }).click();
  await expect(page.locator('.react-flow__node-shape', { hasText: 'Eerste stap' })).toBeVisible();
});

test('a note never becomes a process step', async ({ page }) => {
  await startDrawing(page);
  await page.getByRole('navigation', { name: 'Vormen' }).getByRole('button', { name: 'Notitie' }).click();
  await expect(page.locator('.react-flow__node-shape')).toHaveCount(1);
  await expect(page.getByTestId('validation-issues')).toContainText('geen startpunt');
});

test('resizes a shape from a corner and keeps the size after undo/redo', async ({ page }) => {
  await startDrawing(page);
  await page
    .getByRole('navigation', { name: 'Vormen' })
    .getByRole('button', { name: 'Taak', exact: true })
    .click();
  const node = page.locator('.react-flow__node-shape').first();
  await node.click();
  const before = (await node.boundingBox())!;
  const corner = (await node.locator('.react-flow__resize-control.bottom.right').boundingBox())!;
  await page.mouse.move(corner.x + corner.width / 2, corner.y + corner.height / 2);
  await page.mouse.down();
  await page.mouse.move(corner.x + 60, corner.y + 40, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await node.boundingBox())!.width).toBeGreaterThan(before.width + 40);

  const canvas = page.getByTestId('drawing-canvas');
  await canvas.focus();
  await page.keyboard.press('Control+z');
  await expect.poll(async () => Math.round((await node.boundingBox())!.width)).toBe(Math.round(before.width));
  await page.keyboard.press('Control+Shift+z');
  await expect.poll(async () => (await node.boundingBox())!.width).toBeGreaterThan(before.width + 40);
});
