/**
 * Playwright smoke tests for Deadline Defense
 * Ref: tasks.md Phase 15.2
 * 
 * These tests verify the core user flow in a headless browser:
 * 1. Title boots
 * 2. War Room navigation
 * 3. Trial (practice) flow
 * 4. Battle starts and runs
 * 5. Guided tour on first visit
 * 6. Reduced motion support
 * 
 * All tests fail on any console.error or page error.
 */

import { test, expect } from '@playwright/test';

// Fail on any console error or page error
test.beforeEach(async ({ page }, testInfo) => {
  // Returning players by default (tutorial done, tours seen), so each test
  // reaches the screen it checks. The tour test sets its own save.
  if (!testInfo.title.includes('Guided tour')) {
    await page.addInitScript(() => {
      if (localStorage.getItem('deadline-defense.save')) return;
      localStorage.setItem(
        'deadline-defense.save',
        JSON.stringify({
          version: 1, tutorialDone: true,
          settings: { muted: true, reducedMotion: false, extraTime: false },
          sessions: [], forge: {}, sparks: {}, semester: { source: 'demo' },
          campaign: { wave: 1, bestWave: 0 }, tours: { warroom: true, battle: true },
        }),
      );
    });
  }
  const errors: string[] = [];
  
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(`Console error: ${msg.text()}`);
    }
  });
  
  page.on('pageerror', (error) => {
    errors.push(`Page error: ${error.message}`);
  });
  
  // Store errors array so we can check it in afterEach
  (page as any)._testErrors = errors;
});

test.afterEach(async ({ page }) => {
  const errors = (page as any)._testErrors as string[];
  if (errors.length > 0) {
    throw new Error(`Test had console/page errors:\n${errors.join('\n')}`);
  }
});

test.describe('Deadline Defense Smoke Tests', () => {
  test('1. Title boots: DOM title visible and Enter button exists', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    
    // Wait for the title to be visible (Phaser might take a moment to boot)
    await page.waitForSelector('.title-screen', { timeout: 10000 });
    
    // Check that "Deadline" text is visible in the title
    const titleText = await page.locator('.title-screen').textContent();
    expect(titleText).toContain('Deadline');
    
    // Check that the "Enter the War Room" button exists
    const enterButton = page.locator('.title-screen button:has-text("Enter the War Room")');
    await expect(enterButton).toBeVisible();
  });

  test('2. War Room: pressing Enter shows warroom with 6 course rows and counsel', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    
    // Wait for game to exist and title screen to be visible
    await page.waitForFunction(
      () => (window as any).__dd && document.querySelector('.title-screen'),
      { timeout: 15000 }
    );
    await page.waitForTimeout(1000);
    
    // Click to go to War Room
    await page.click('button[data-action="start"]');
    
    // Wait for WarRoomScene to be active
    await page.waitForFunction(
      () => {
        const game = (window as any).__dd;
        return game?.scene?.getScenes(true)?.some((s: any) => s?.scene?.key === 'WarRoomScene');
      },
      { timeout: 15000 }
    );
    
    // Now check DOM
    await page.waitForSelector('.warroom', { timeout: 5000 });
    const rows = page.locator('.wr-row');
    await expect(rows).toHaveCount(6);
    
    const counsel = page.locator('.wr-counsel');
    await expect(counsel).toBeVisible();
  });

  test('3. Trial: clicking train button opens grimoire, pressing 1 marks choice, Escape closes', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => (window as any).__dd?.isRunning, { timeout: 10000 });
    await page.waitForSelector('button[data-action="start"]', { state: 'visible' });
    await page.waitForTimeout(1000);
    
    // Navigate to War Room
    await page.click('button[data-action="start"]');
    await page.waitForFunction(
      () => {
        const game = (window as any).__dd;
        return game?.scene?.getScenes(true)?.some((s: any) => s?.scene?.key === 'WarRoomScene');
      },
      { timeout: 15000 }
    );
    await page.waitForSelector('.warroom', { timeout: 5000 });
    
    // Click the first train button
    const trainButton = page.locator('[data-train]').first();
    await trainButton.click();
    
    // Wait for grimoire (trial panel) to open
    await page.waitForSelector('.grimoire', { timeout: 5000 });
    
    // Check that there are 4 choice buttons
    const choices = page.locator('.choice');
    await expect(choices).toHaveCount(4);
    
    // Press "1" to select first choice
    await page.keyboard.press('1');
    
    // Wait for a choice to be marked as right (correct answer) or wrong
    // At least one choice should have .right class after answering
    await page.waitForSelector('.choice.right', { timeout: 3000 });
    const rightChoice = page.locator('.choice.right');
    await expect(rightChoice).toBeVisible();
    
    // Press Escape to close the trial
    await page.keyboard.press('Escape');
    
    // Wait for grimoire to disappear
    await page.waitForSelector('.grimoire', { state: 'detached', timeout: 3000 });
  });

  test('4. Battle: press b from title, scout appears, Enter starts battle, enemies spawn', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => (window as any).__dd?.isRunning, { timeout: 10000 });
    await page.waitForSelector('button[data-action="battle"]', { state: 'visible' });
    await page.waitForTimeout(1000);
    
    // Click "Skip to battle" button
    await page.click('button[data-action="battle"]');
    
    // Wait for BattleScene to be active
    await page.waitForFunction(
      () => {
        const game = (window as any).__dd;
        return game?.scene?.getScenes(true)?.some((s: any) => s?.scene?.key === 'BattleScene');
      },
      { timeout: 15000 }
    );
    
    // Wait for scout report to appear
    await page.waitForSelector('.scout-page', { timeout: 5000 });
    
    // Click the "Begin the battle" button
    const beginButton = page.locator('button[data-begin]');
    await beginButton.click();
    
    // Wait up to 10 seconds for battle phase to be 'fight'
    await page.waitForFunction(
      () => {
        const game = (window as any).__dd;
        const scene = game?.scene?.getScene?.('BattleScene');
        return scene?.phase === 'fight';
      },
      { timeout: 10000 }
    );
    
    // Check that the 3D canvas exists
    const canvas = page.locator('canvas.dd-3d');
    await expect(canvas).toBeVisible();
    
    // Wait for enemies to appear on the field (check gameState after 8 seconds)
    await page.waitForTimeout(8000);
    
    const hasEnemies = await page.evaluate(() => {
      const game = (window as any).__dd;
      const scene = game?.scene?.getScene?.('BattleScene');
      const gameState = scene?.gameState;
      
      // Check if there are enemies or pending spawns
      const enemyCount = gameState?.enemies?.length || 0;
      const pendingCount = gameState?.pending?.length || 0;
      
      return enemyCount > 0 || pendingCount < (scene?.initialPending || 0);
    });
    
    expect(hasEnemies).toBeTruthy();
  });

  test('5. Guided tour: with empty tours object, War Room shows tour-card, Escape closes and saves', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    
    // Set up localStorage with tours = {} to trigger tour
    await page.evaluate(() => {
      const save = {
        version: 1,
        tutorialDone: true,
        settings: { muted: false, reducedMotion: false, extraTime: false },
        sessions: [],
        forge: {},
        sparks: {},
        semester: { source: 'demo' },
        campaign: { wave: 1, bestWave: 0 },
        tours: {} // Empty tours to trigger first visit
      };
      localStorage.setItem('deadline-defense.save', JSON.stringify(save));
    });
    
    // Reload to pick up the new save
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => (window as any).__dd?.isRunning, { timeout: 10000 });
    await page.waitForSelector('button[data-action="start"]', { state: 'visible' });
    await page.waitForTimeout(1000);
    
    // Navigate to War Room
    await page.click('button[data-action="start"]');
    await page.waitForFunction(
      () => {
        const game = (window as any).__dd;
        return game?.scene?.getScenes(true)?.some((s: any) => s?.scene?.key === 'WarRoomScene');
      },
      { timeout: 15000 }
    );
    await page.waitForSelector('.warroom', { timeout: 5000 });
    
    // Wait for tour card to appear (may take a moment after scene loads)
    await page.waitForSelector('.tour-card', { timeout: 5000 });
    const tourCard = page.locator('.tour-card');
    await expect(tourCard).toBeVisible();
    
    // Press Escape to close the tour
    await page.keyboard.press('Escape');
    
    // Wait for tour to disappear
    await page.waitForSelector('.tour-card', { state: 'detached', timeout: 3000 });
    
    // Check that tours.warroom is now true in save
    const toursMarked = await page.evaluate(() => {
      const saveStr = localStorage.getItem('deadline-defense.save');
      if (!saveStr) return false;
      const save = JSON.parse(saveStr);
      return save.tours?.warroom === true;
    });
    
    expect(toursMarked).toBeTruthy();
  });

  test('6. Reduced motion: battle starts with no errors when reduced motion is enabled', async ({ page }) => {
    // Enable reduced motion preference
    await page.emulateMedia({ reducedMotion: 'reduce' });
    
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => (window as any).__dd?.isRunning, { timeout: 10000 });
    await page.waitForSelector('button[data-action="battle"]', { state: 'visible' });
    await page.waitForTimeout(1000);
    
    // Click "Skip to battle" button
    await page.click('button[data-action="battle"]');
    await page.waitForFunction(
      () => {
        const game = (window as any).__dd;
        return game?.scene?.getScenes(true)?.some((s: any) => s?.scene?.key === 'BattleScene');
      },
      { timeout: 15000 }
    );
    await page.waitForSelector('.scout-page', { timeout: 5000 });
    
    // Click "Begin the battle" button
    const beginButton = page.locator('button[data-begin]');
    await beginButton.click();
    
    // Wait for battle to start
    await page.waitForFunction(
      () => {
        const game = (window as any).__dd;
        const scene = game?.scene?.getScene?.('BattleScene');
        return scene?.phase === 'fight';
      },
      { timeout: 10000 }
    );
    
    // Check canvas is visible
    const canvas = page.locator('canvas.dd-3d');
    await expect(canvas).toBeVisible();
    
    // No additional checks needed - if we got here without console errors, the test passes
    // The beforeEach/afterEach hooks will catch any console errors
  });
});

test.describe('Init script test helpers', () => {
  test('Skip tours helper: can set tours and tutorialDone to bypass tutorials', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    
    // Set tours and tutorialDone in an init script pattern
    await page.evaluate(() => {
      const save = {
        version: 1,
        tutorialDone: true,
        settings: { muted: false, reducedMotion: false, extraTime: false },
        sessions: [],
        forge: {},
        sparks: {},
        semester: { source: 'demo' },
        campaign: { wave: 1, bestWave: 0 },
        tours: { warroom: true, battle: true }
      };
      localStorage.setItem('deadline-defense.save', JSON.stringify(save));
    });
    
    // Reload and verify no tour appears
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => (window as any).__dd?.isRunning, { timeout: 10000 });
    await page.waitForSelector('button[data-action="start"]', { state: 'visible' });
    await page.waitForTimeout(1000);
    await page.click('button[data-action="start"]');
    await page.waitForFunction(
      () => {
        const game = (window as any).__dd;
        return game?.scene?.getScenes(true)?.some((s: any) => s?.scene?.key === 'WarRoomScene');
      },
      { timeout: 15000 }
    );
    await page.waitForSelector('.warroom', { timeout: 5000 });
    
    // Tour should not appear
    const tourCard = page.locator('.tour-card');
    await expect(tourCard).not.toBeVisible();
  });
});
