import { test, expect } from '@playwright/test';
import {
  gotoAdminReconciliation,
  mockSorobanRpc,
  MOCK_ADMIN_ADDRESS,
  connectMockWallet,
} from './helpers';

/** Non-admin wallet address (valid 56-char Stellar key). */
const NON_ADMIN_ADDRESS =
  'G9876543210987654321098765432109876543210987654321098765';

test.describe('Admin Reconciliation E2E', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAdminReconciliation(page);
  });

  test.describe('Page load', () => {
    test('loads the reconciliation dashboard for admin users', async ({ page }) => {
      const heading = page.getByRole('heading', {
        name: /Admin Reconciliation Dashboard/i,
      });
      await expect(heading).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/Export CSV/i)).toBeVisible();
    });

    test('renders filter controls', async ({ page }) => {
      const statusSelect = page.getByLabel(/Status/i);
      await expect(statusSelect).toBeVisible({ timeout: 10_000 });
      await expect(statusSelect).toHaveValue('all');

      await expect(page.getByLabel(/Start Date/i)).toBeVisible();
      await expect(page.getByLabel(/End Date/i)).toBeVisible();
    });

    test('renders reconciliation table with records', async ({ page }) => {
      await expect(page.getByRole('table')).toBeVisible({ timeout: 10_000 });
      const rows = page.getByRole('row');
      const count = await rows.count();
      expect(count).toBeGreaterThan(1);
    });
  });

  test.describe('Filtering', () => {
    test('filters records by status', async ({ page }) => {
      const statusSelect = page.getByLabel(/Status/i);
      await statusSelect.selectOption('matched');

      const rows = page.locator('tbody tr');
      const count = await rows.count();
      for (let i = 0; i < count; i++) {
        await expect(rows.nth(i).getByText('matched')).toBeVisible();
      }
    });

    test('shows "No records found" when filter matches nothing', async ({
      page,
    }) => {
      const statusSelect = page.getByLabel(/Status/i);
      await statusSelect.selectOption('error');

      // Narrow date range so no records match
      await page.getByLabel(/Start Date/i).fill('2099-01-01');
      await page.getByLabel(/End Date/i).fill('2099-12-31');

      await expect(
        page.getByText(/No records found matching the filters/i),
      ).toBeVisible();
    });

    test('resets to all records when status filter is changed back', async ({
      page,
    }) => {
      const statusSelect = page.getByLabel(/Status/i);

      await statusSelect.selectOption('matched');
      await statusSelect.selectOption('all');

      const rows = page.locator('tbody tr');
      const count = await rows.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe('CSV Export', () => {
    test('Export CSV button is visible and enabled', async ({ page }) => {
      const exportBtn = page.getByRole('button', { name: /Export CSV/i });
      await expect(exportBtn).toBeVisible();
      await expect(exportBtn).toBeEnabled();
    });

    test('triggers CSV download on click', async ({ page }) => {
      const downloadPromise = page.waitForEvent('download', { timeout: 10_000 });
      const exportBtn = page.getByRole('button', { name: /Export CSV/i });
      await exportBtn.click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/reconciliation.*\.csv/);
    });
  });

  test.describe('Non-admin redirect', () => {
    test('non-admin users are redirected away from reconciliation page', async ({
      page,
    }) => {
      await mockSorobanRpc(page, { adminAddress: MOCK_ADMIN_ADDRESS });
      await page.goto('/admin/reconciliation');
      await page.waitForLoadState('domcontentloaded');
      await connectMockWallet(page, NON_ADMIN_ADDRESS);

      await expect(
        page.getByRole('heading', { name: /Admin Reconciliation Dashboard/i }),
      ).toBeHidden({ timeout: 15_000 });
      await expect(page.getByText(/Stellar Wave|Connect|Launch/i).first()).toBeVisible({
        timeout: 15_000,
      });
    });
  });
});
