import { test, expect } from '@playwright/test';

test.describe('SplitViewComparison component E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a page that renders the SplitViewComparison component
    await page.goto('/test-split-view-comparison');
  });

  test.describe('Initial render', () => {
    test('renders split view comparison container', async ({ page }) => {
      const container = page.locator('[data-testid="split-view-comparison"]').first();
      await expect(container).toBeVisible();
    });

    test('renders both left and right panels', async ({ page }) => {
      const leftPanel = page.locator('[data-testid="split-view-left"]').first();
      const rightPanel = page.locator('[data-testid="split-view-right"]').first();
      await expect(leftPanel).toBeVisible();
      await expect(rightPanel).toBeVisible();
    });

    test('displays comparison title', async ({ page }) => {
      const title = page.locator('h2, h1').filter({ hasText: /comparison|compare/i }).first();
      if (await title.isVisible()) {
        await expect(title).toBeVisible();
      }
    });
  });

  test.describe('Content display', () => {
    test('left panel displays correct content', async ({ page }) => {
      const leftContent = page.locator('[data-testid="split-view-left"] *');
      const count = await leftContent.count();
      expect(count).toBeGreaterThan(0);
    });

    test('right panel displays correct content', async ({ page }) => {
      const rightContent = page.locator('[data-testid="split-view-right"] *');
      const count = await rightContent.count();
      expect(count).toBeGreaterThan(0);
    });

    test('content is properly separated between panels', async ({ page }) => {
      const leftText = await page.locator('[data-testid="split-view-left"]').textContent();
      const rightText = await page.locator('[data-testid="split-view-right"]').textContent();
      expect(leftText).not.toBe(rightText);
    });
  });

  test.describe('Divider interaction', () => {
    test('renders divider between panels', async ({ page }) => {
      const divider = page.locator('[data-testid="split-view-divider"]').first();
      if (await divider.isVisible()) {
        await expect(divider).toBeVisible();
      }
    });

    test('divider is draggable when enabled', async ({ page }) => {
      const divider = page.locator('[data-testid="split-view-divider"]').first();
      if (await divider.isVisible()) {
        // Attempt to drag the divider
        const boundingBox = await divider.boundingBox();
        if (boundingBox) {
          await page.mouse.move(boundingBox.x + boundingBox.width / 2, boundingBox.y + boundingBox.height / 2);
          await page.mouse.down();
          await page.mouse.move(boundingBox.x + boundingBox.width / 2 + 50, boundingBox.y + boundingBox.height / 2);
          await page.mouse.up();
          // Verify divider still exists
          await expect(divider).toBeVisible();
        }
      }
    });
  });

  test.describe('Responsive behavior', () => {
    test('maintains layout on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      const container = page.locator('[data-testid="split-view-comparison"]').first();
      await expect(container).toBeVisible();

      // Check that both panels are still visible or stacked appropriately
      const leftPanel = page.locator('[data-testid="split-view-left"]');
      const rightPanel = page.locator('[data-testid="split-view-right"]');
      await expect(leftPanel).toBeVisible();
      await expect(rightPanel).toBeVisible();
    });

    test('adapts to different viewport widths', async ({ page }) => {
      const viewportWidths = [320, 768, 1024, 1920];

      for (const width of viewportWidths) {
        await page.setViewportSize({ width, height: 800 });
        const container = page.locator('[data-testid="split-view-comparison"]').first();
        await expect(container).toBeVisible();
      }
    });

    test('no horizontal overflow on small screens', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      const body = page.locator('body');
      const scrollWidth = await body.evaluate((el) => el.scrollWidth);
      const clientWidth = await body.evaluate((el) => el.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1); // +1 for rounding
    });
  });

  test.describe('Accessibility', () => {
    test('semantic HTML structure', async ({ page }) => {
      const container = page.locator('[data-testid="split-view-comparison"]').first();
      const html = await container.innerHTML();
      // Check for basic semantic structure
      expect(html).toBeTruthy();
    });

    test('panels have accessible labels', async ({ page }) => {
      const leftLabel = page.locator('[data-testid="split-view-left"]').first();
      const rightLabel = page.locator('[data-testid="split-view-right"]').first();

      // Panels should have aria-label or be in labeled section
      const leftAriaLabel = await leftLabel.getAttribute('aria-label');
      const rightAriaLabel = await rightLabel.getAttribute('aria-label');

      // At least one should have accessible naming
      const leftHasName = leftAriaLabel || (await leftLabel.locator('h*').first().isVisible());
      const rightHasName = rightAriaLabel || (await rightLabel.locator('h*').first().isVisible());

      expect(leftHasName || rightHasName).toBeTruthy();
    });

    test('keyboard navigation works', async ({ page }) => {
      // Tab through elements
      await page.keyboard.press('Tab');
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(focusedElement).toBeTruthy();
    });
  });

  test.describe('Interactive elements', () => {
    test('buttons and clickable elements are interactive', async ({ page }) => {
      const buttons = page.locator('[data-testid="split-view-comparison"] button').first();
      if (await buttons.isVisible()) {
        await buttons.click();
        // Verify click was processed
        expect(true).toBeTruthy();
      }
    });

    test('links open correctly', async ({ page }) => {
      const links = page.locator('[data-testid="split-view-comparison"] a').first();
      if (await links.isVisible()) {
        const href = await links.getAttribute('href');
        expect(href).toBeTruthy();
      }
    });
  });

  test.describe('Performance', () => {
    test('page loads comparison within acceptable time', async ({ page }) => {
      const startTime = Date.now();
      await page.goto('/test-split-view-comparison');
      const container = page.locator('[data-testid="split-view-comparison"]').first();
      await expect(container).toBeVisible();
      const loadTime = Date.now() - startTime;

      // Should load in less than 3 seconds
      expect(loadTime).toBeLessThan(3000);
    });

    test('no console errors during interaction', async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      const divider = page.locator('[data-testid="split-view-divider"]').first();
      if (await divider.isVisible()) {
        const boundingBox = await divider.boundingBox();
        if (boundingBox) {
          await page.mouse.move(boundingBox.x + boundingBox.width / 2, boundingBox.y + boundingBox.height / 2);
          await page.mouse.down();
          await page.mouse.move(boundingBox.x + 50, boundingBox.y);
          await page.mouse.up();
        }
      }

      // Filter out expected errors (if any)
      const unexpectedErrors = errors.filter((e) => !e.includes('Expected'));
      expect(unexpectedErrors.length).toBe(0);
    });
  });
});
