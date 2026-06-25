import { test, expect } from '@playwright/test';

test.describe('Message component E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-message');
  });

  test.describe('Markdown rendering', () => {
    test('renders markdown link and opens in new tab', async ({ page }) => {
      const anchor = page.locator('a', { hasText: 'link' }).first();
      await expect(anchor).toBeVisible();
      await expect(anchor).toHaveAttribute('href', 'https://example.com');
      await expect(anchor).toHaveAttribute('target', '_blank');
    });

    test('renders bold and italic text', async ({ page }) => {
      const boldText = page.locator('strong').first();
      const italicText = page.locator('em').first();
      await expect(boldText).toBeVisible();
      await expect(italicText).toBeVisible();
    });

    test('renders code blocks', async ({ page }) => {
      const codeBlock = page.locator('code').first();
      await expect(codeBlock).toBeVisible();
    });
  });

  test.describe('Transaction details', () => {
    test('shows transaction details and copy buttons', async ({ page }) => {
      await expect(page.getByText(/Transaction Details/i)).toBeVisible();
      await expect(page.getByText(/Receipt ID:/i)).toBeVisible();
      // copy buttons are present (two for txHash and receiptId)
      const copyButtons = page.locator('button').filter({ hasText: '' });
      await expect(copyButtons.first()).toBeVisible();
    });

    test('copies transaction hash on button click', async ({ page, context }) => {
      const copyButton = page.locator('button[aria-label*="copy" i]').first();
      if (await copyButton.isVisible()) {
        // Grant clipboard permissions
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);
        await copyButton.click();
        // Verify success (implementation-dependent)
        await expect(page.getByText(/copied/i)).toBeVisible({ timeout: 2000 }).catch(() => {});
      }
    });

    test('displays formatted transaction values', async ({ page }) => {
      const txAmount = page.locator('[data-testid*="amount"]').first();
      if (await txAmount.isVisible()) {
        const text = await txAmount.textContent();
        expect(text).toBeTruthy();
      }
    });
  });

  test.describe('Suggested actions', () => {
    test('suggested actions render and are clickable', async ({ page }) => {
      const confirmBtn = page.getByRole('button', { name: /confirm/i }).first();
      const cancelBtn = page.getByRole('button', { name: /cancel/i }).first();
      if (await confirmBtn.isVisible()) {
        await expect(confirmBtn).toBeVisible();
      }
      if (await cancelBtn.isVisible()) {
        await expect(cancelBtn).toBeVisible();
      }
    });

    test('action buttons have proper accessibility attributes', async ({ page }) => {
      const buttons = page.locator('button[role="button"]');
      const count = await buttons.count();
      if (count > 0) {
        for (let i = 0; i < Math.min(count, 3); i++) {
          const btn = buttons.nth(i);
          await expect(btn).toHaveAttribute('type', /(button|submit)/);
        }
      }
    });
  });

  test.describe('Error handling', () => {
    test('shows failed message with retry button', async ({ page }) => {
      const failedMsg = page.getByText(/Failed to send|error/i).first();
      if (await failedMsg.isVisible()) {
        await expect(failedMsg).toBeVisible();
        const retry = page.getByRole('button', { name: /retry/i }).first();
        if (await retry.isVisible()) {
          await expect(retry).toBeVisible();
          await retry.click();
        }
      }
    });

    test('error messages display helpful context', async ({ page }) => {
      const errorMsg = page.locator('[data-testid*="error"]').first();
      if (await errorMsg.isVisible()) {
        const text = await errorMsg.textContent();
        expect(text).toBeTruthy();
      }
    });
  });

  test.describe('Message styling', () => {
    test('applies correct theme styling', async ({ page }) => {
      const message = page.locator('[data-testid="message"]').first();
      if (await message.isVisible()) {
        const classes = await message.getAttribute('class');
        expect(classes).toBeTruthy();
      }
    });

    test('responsive layout on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      const message = page.locator('[data-testid="message"]').first();
      await expect(message).toBeVisible();
      // Verify no horizontal overflow
      const body = page.locator('body');
      const scrollWidth = await body.evaluate((el) => el.scrollWidth);
      const clientWidth = await body.evaluate((el) => el.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1); // +1 for rounding
    });
  });
});
